import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
    FunnelIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    CubeIcon,
    TagIcon,
    PrinterIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";

interface Category {
    id: number;
    name: string;
    description?: string;
}

enum UOM {
    PIECES = "PIECES",
    BOX = "BOX",
    PACK = "PACK",
    KILOGRAM = "KILOGRAM",
    GRAM = "GRAM",
    LITRE = "LITRE",
    MILLILITRE = "MILLILITRE",
    METER = "METER",
    CENTIMETER = "CENTIMETER",
    MILLIMETER = "MILLIMETER",
    DOZEN = "DOZEN",
    BAG = "BAG",
    ROLL = "ROLL",
}

interface Product {
    id: number;
    name: string;
    uom: UOM;
    qcRequired: boolean;
    batchControlled: boolean;
    serialControlled: boolean;
    category?: Category;
    sku?: string;
    createdAt?: string;
    updatedAt?: string;
}

const API_URL = "/v1/api/inventory";
const PAGE_SIZE = 10;

const ProductSKUManager: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [uomFilter, setUomFilter] = useState<string>("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

    const [form, setForm] = useState({
        name: "",
        uom: UOM.PIECES,
        qcRequired: false,
        batchControlled: false,
        serialControlled: false,
        categoryId: "",
    });

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

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

    const fetchCategories = async () => {
        try {
            const response = await axios.get(`${API_URL}/categories`);
            setCategories(response.data);
        } catch (err) {
            console.error("Failed to load categories", err);
            ToasterService.error("Failed to load categories");
            setCategories([]);
        }
    };

    const clearForm = () => {
        setForm({
            name: "",
            uom: UOM.PIECES,
            qcRequired: false,
            batchControlled: false,
            serialControlled: false,
            categoryId: "",
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleChange = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const buildPayload = () => ({
        name: form.name,
        uom: form.uom,
        qcRequired: form.qcRequired,
        batchControlled: form.batchControlled,
        serialControlled: form.serialControlled,
        category: form.categoryId ? { id: Number(form.categoryId) } : null,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingId) {
                await axios.put(`${API_URL}/products/${editingId}`, buildPayload());
                ToasterService.success("Product updated successfully");
            } else {
                await axios.post(`${API_URL}/products`, buildPayload());
                ToasterService.success("Product created successfully");
            }
            await fetchProducts();
            clearForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setForm({
            name: product.name,
            uom: product.uom,
            qcRequired: product.qcRequired,
            batchControlled: product.batchControlled,
            serialControlled: product.serialControlled,
            categoryId: product.category?.id?.toString() || "",
        });
        setShowForm(true);
    };

    const confirmDelete = async () => {
        if (!deletingProduct) return;
        try {
            await axios.delete(`${API_URL}/products/${deletingProduct.id}`);
            ToasterService.success("Product deleted successfully");
            await fetchProducts();
            setShowDeletePopup(false);
            setDeletingProduct(null);
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const promptDelete = (product: Product) => {
        setDeletingProduct(product);
        setShowDeletePopup(true);
    };

    const openCreateProduct = () => {
        clearForm();
        setShowForm(true);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Products Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Products: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["SKU", "Product Name", "Category", "UOM", "QC Required", "Batch Controlled", "Serial Controlled"]],
            body: filtered.map(p => [
                p.sku || "-",
                p.name,
                p.category?.name || "-",
                p.uom,
                p.qcRequired ? "Yes" : "No",
                p.batchControlled ? "Yes" : "No",
                p.serialControlled ? "Yes" : "No",
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Products_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(p => ({
            'SKU': p.sku || "-",
            'Product Name': p.name,
            'Category': p.category?.name || "-",
            'UOM': p.uom,
            'QC Required': p.qcRequired ? "Yes" : "No",
            'Batch Controlled': p.batchControlled ? "Yes" : "No",
            'Serial Controlled': p.serialControlled ? "Yes" : "No",
            'Created At': p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Products");
        XLSX.writeFile(wb, `Products_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = products.filter((p) => {
        const matchesCategory = categoryFilter ? p.category?.name === categoryFilter : true;
        const matchesUom = uomFilter ? p.uom === uomFilter : true;
        return matchesCategory && matchesUom;
    });

    // Calculate stats from real data
    const totalProducts = products.length;
    const totalCategories = categories.length;
    const qcRequiredCount = products.filter(p => p.qcRequired).length;
    const batchControlledCount = products.filter(p => p.batchControlled).length;

    // Get unique values for filters
    const uniqueCategories = [...new Set(products.map(p => p.category?.name).filter(Boolean))];
    const uniqueUoms = [...new Set(products.map(p => p.uom))];

    // Status badge component for boolean values
    const getBooleanBadge = (value: boolean, label: string) => {
        if (value) {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    {label}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600">
                <XCircleIcon className="h-3 w-3 mr-1" />
                {label}
            </span>
        );
    };

    const columns: ColumnDef<Product>[] = [
        {
            key: "sku",
            label: "SKU",
            sortable: true,
            render: (product) => (
                <span className="text-xs font-mono text-gray-600">{product.sku || "-"}</span>
            ),
        },
        {
            key: "name",
            label: "Product Name",
            sortable: true,
            render: (product) => (
                <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                        <CubeIcon className="h-3.5 w-3.5 text-cyan-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 leading-tight">{product.name}</span>
                </div>
            ),
        },
        {
            key: "categoryName",
            label: "Category",
            sortable: false,
            render: (product) => (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-purple-100 text-purple-800">
                    {product.category?.name || "-"}
                </span>
            ),
        },
        {
            key: "uom",
            label: "UOM",
            sortable: true,
            render: (product) => <span className="text-xs text-gray-600">{product.uom}</span>,
        },
        {
            key: "qcRequired",
            label: "QC Required",
            sortable: true,
            render: (product) => getBooleanBadge(product.qcRequired, "QC Required"),
        },
        {
            key: "batchControlled",
            label: "Batch Control",
            sortable: true,
            render: (product) => getBooleanBadge(product.batchControlled, "Batch Control"),
        },
        {
            key: "serialControlled",
            label: "Serial Control",
            sortable: true,
            render: (product) => getBooleanBadge(product.serialControlled, "Serial Control"),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "!text-right pr-8",
            className: "text-right",
            render: (product) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                            <EllipsisVerticalIcon className="h-4.5 w-4.5 text-gray-500" />
                        </Menu.Button>
                        <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]">
                            <Menu.Item>
                                {({ active }) => (
                                    <button
                                        onClick={() => {
                                            setSelectedProduct(product);
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
                                        onClick={() => handleEdit(product)}
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
                                        onClick={() => promptDelete(product)}
                                        className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600`}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        Delete
                                    </button>
                                )}
                            </Menu.Item>
                        </Menu.Items>
                    </Menu>
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title="Product Manager" description="Manage products and SKU configurations" />
            <PageBreadcrumb pageTitle="Product Manager" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => navigate("/inventory-categories")}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors flex items-center gap-2"
                        >
                            <TagIcon className="h-4 w-4" />
                            Categories
                        </button>
                        <AddButton onClick={openCreateProduct} label="Add Product" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Products" value={totalProducts} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
                    <StatsCard label="Categories" value={totalCategories} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
                    <StatsCard label="QC Required" value={qcRequiredCount} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
                    <StatsCard label="Batch Controlled" value={batchControlledCount} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    value={categoryFilter}
                                    onChange={e => setCategoryFilter(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Categories</option>
                                    {uniqueCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
                                <select
                                    value={uomFilter}
                                    onChange={e => setUomFilter(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All UOMs</option>
                                    {uniqueUoms.map(uom => (
                                        <option key={uom} value={uom}>{uom}</option>
                                    ))}
                                </select>
                            </div>
                            {(categoryFilter || uomFilter) && (
                                <button
                                    onClick={() => {
                                        setCategoryFilter("");
                                        setUomFilter("");
                                    }}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Product Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={clearForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                {editingId ? "Edit Product" : "Add New Product"}
                                            </h3>
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Product Name</label>
                                                    <input
                                                        type="text"
                                                        value={form.name}
                                                        onChange={e => handleChange("name", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Category</label>
                                                    <select
                                                        value={form.categoryId}
                                                        onChange={e => handleChange("categoryId", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    >
                                                        <option value="">Select Category</option>
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Unit of Measure</label>
                                                    <select
                                                        value={form.uom}
                                                        onChange={e => handleChange("uom", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                    >
                                                        {Object.values(UOM).map(uom => (
                                                            <option key={uom} value={uom}>{uom}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.qcRequired}
                                                            onChange={e => handleChange("qcRequired", e.target.checked)}
                                                            className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 mr-2"
                                                        />
                                                        <span className="text-sm text-gray-700">QC Required</span>
                                                    </label>
                                                    <label className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.batchControlled}
                                                            onChange={e => handleChange("batchControlled", e.target.checked)}
                                                            className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 mr-2"
                                                        />
                                                        <span className="text-sm text-gray-700">Batch Controlled</span>
                                                    </label>
                                                    <label className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.serialControlled}
                                                            onChange={e => handleChange("serialControlled", e.target.checked)}
                                                            className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 mr-2"
                                                        />
                                                        <span className="text-sm text-gray-700">Serial Controlled</span>
                                                    </label>
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
                    <ReusableTable<Product>
                        data={filtered}
                        columns={columns}
                        searchable
                        searchPlaceholder="Search by name, SKU, or UOM..."
                        searchFields={["name", "sku", "uom"]}
                        pageSize={PAGE_SIZE}
                        defaultSortKey="name"
                        toolbar={
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                        disabled={products.length === 0}
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
                                <button
                                    onClick={() => window.print()}
                                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                    disabled={products.length === 0}
                                >
                                    <PrinterIcon className="h-5 w-5 text-gray-600" />
                                </button>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2 rounded-lg border ${showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"}`}
                                >
                                    <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
                                </button>
                                <button
                                    onClick={fetchProducts}
                                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                >
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
                                <p className="text-gray-500 text-sm font-medium mb-1.5">No products found</p>
                                <button
                                    onClick={openCreateProduct}
                                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                                >
                                    Add your first product
                                </button>
                            </div>
                        }
                    />
                )}

                {/* View Details Modal */}
                {viewModalOpen && selectedProduct && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Product Details
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
                                                        <p className="text-xs text-gray-500">SKU</p>
                                                        <p className="text-sm font-mono text-gray-900">{selectedProduct.sku || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Product Name</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedProduct.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Category</p>
                                                        <p className="text-sm text-gray-700">{selectedProduct.category?.name || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Unit of Measure</p>
                                                        <p className="text-sm text-gray-700">{selectedProduct.uom}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">QC Required</p>
                                                        <p className="text-sm">{getBooleanBadge(selectedProduct.qcRequired, "Yes")}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Batch Controlled</p>
                                                        <p className="text-sm">{getBooleanBadge(selectedProduct.batchControlled, "Yes")}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Serial Controlled</p>
                                                        <p className="text-sm">{getBooleanBadge(selectedProduct.serialControlled, "Yes")}</p>
                                                    </div>
                                                    {selectedProduct.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Created At</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedProduct.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewModalOpen(false);
                                            handleEdit(selectedProduct);
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
                    innerText="Delete Product"
                    subText={deletingProduct ? `Are you sure you want to delete "${deletingProduct.name}"? This action cannot be undone.` : "Are you sure you want to delete this product?"}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={confirmDelete}
                    onCancel={() => setDeletingProduct(null)}
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                />
            </div>
        </>
    );
};

export default ProductSKUManager;

