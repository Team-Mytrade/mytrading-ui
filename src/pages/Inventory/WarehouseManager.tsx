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
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    HomeIcon,
    PrinterIcon,
    TruckIcon,
    MapPinIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";

interface Warehouse {
    id: number;
    code: string;
    name: string;
    locationType: "MAIN" | "SECONDARY" | "DISTRIBUTION" | "STORAGE";
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

interface FilterParams {
    code?: string;
    name?: string;
    locationType?: string;
    page: number;
    size: number;
    sort?: string[];
}

const API_URL = "/v1/api/inventory/warehouses";
const PAGE_SIZE = 10;

const WarehousePage: React.FC = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem("accessToken");
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [locationTypeFilter, setLocationTypeFilter] = useState<string>("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);

    const [form, setForm] = useState<Omit<Warehouse, "id">>({
        code: "",
        name: "",
        locationType: "MAIN",
        address: "",
        city: "",
        state: "",
        pincode: "",
        phone: "",
        email: "",
        isActive: true,
    });

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        try {
            const response = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setWarehouses(response.data);
        } catch (err) {
            console.error("Error loading warehouses:", err);
            ToasterService.error("Failed to load warehouses");
            setWarehouses([]);
        }
    };

    const applyFilters = async () => {
        try {
            const filterParams: FilterParams = {
                page: 0,
                size: 100,
            };

            if (locationTypeFilter) filterParams.locationType = locationTypeFilter;

            const response = await axios.get(`${API_URL}/filter`, {
                params: filterParams,
                headers: { Authorization: `Bearer ${token}` },
            });
            setWarehouses(response.data.content || response.data);
            setShowFilters(false);
        } catch (err) {
            console.error("Error applying filters:", err);
            ToasterService.error("Failed to apply filters");
        }
    };

    const clearFilters = () => {
        setLocationTypeFilter("");
        fetchWarehouses();
        setShowFilters(false);
    };

    const clearForm = () => {
        setForm({
            code: "",
            name: "",
            locationType: "MAIN",
            address: "",
            city: "",
            state: "",
            pincode: "",
            phone: "",
            email: "",
            isActive: true,
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingId) {
                await axios.put(`${API_URL}/${editingId}`, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                ToasterService.success("Warehouse updated successfully");
            } else {
                await axios.post(API_URL, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                ToasterService.success("Warehouse created successfully");
            }
            await fetchWarehouses();
            clearForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const handleEdit = (warehouse: Warehouse) => {
        setEditingId(warehouse.id);
        setForm({
            code: warehouse.code,
            name: warehouse.name,
            locationType: warehouse.locationType,
            address: warehouse.address || "",
            city: warehouse.city || "",
            state: warehouse.state || "",
            pincode: warehouse.pincode || "",
            phone: warehouse.phone || "",
            email: warehouse.email || "",
            isActive: warehouse.isActive !== undefined ? warehouse.isActive : true,
        });
        setShowForm(true);
    };

    const confirmDelete = async () => {
        if (!deletingWarehouse) return;
        try {
            await axios.delete(`${API_URL}/${deletingWarehouse.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            ToasterService.success("Warehouse deleted successfully");
            await fetchWarehouses();
            setShowDeletePopup(false);
            setDeletingWarehouse(null);
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const promptDelete = (warehouse: Warehouse) => {
        setDeletingWarehouse(warehouse);
        setShowDeletePopup(true);
    };

    const openCreateWarehouse = () => {
        clearForm();
        setShowForm(true);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Warehouses Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Warehouses: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Code", "Name", "Location Type", "Address", "City", "Status"]],
            body: filtered.map(w => [
                w.code,
                w.name,
                w.locationType,
                w.address || "-",
                w.city || "-",
                w.isActive !== false ? "Active" : "Inactive",
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Warehouses_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(w => ({
            'Code': w.code,
            'Name': w.name,
            'Location Type': w.locationType,
            'Address': w.address || "-",
            'City': w.city || "-",
            'State': w.state || "-",
            'Pincode': w.pincode || "-",
            'Phone': w.phone || "-",
            'Email': w.email || "-",
            'Status': w.isActive !== false ? "Active" : "Inactive",
            'Created At': w.createdAt ? new Date(w.createdAt).toLocaleDateString() : "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Warehouses");
        XLSX.writeFile(wb, `Warehouses_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = warehouses.filter((w) => {
        const matchesType = locationTypeFilter ? w.locationType === locationTypeFilter : true;
        return matchesType;
    });

    // Calculate stats from real data
    const totalWarehouses = warehouses.length;
    const mainWarehouses = warehouses.filter(w => w.locationType === "MAIN").length;
    const secondaryWarehouses = warehouses.filter(w => w.locationType === "SECONDARY").length;
    const distributionWarehouses = warehouses.filter(w => w.locationType === "DISTRIBUTION").length;
    const storageWarehouses = warehouses.filter(w => w.locationType === "STORAGE").length;

    const getLocationTypeColor = (type: string) => {
        switch (type) {
            case "MAIN":
                return "bg-purple-100 text-purple-800 border-purple-200";
            case "SECONDARY":
                return "bg-blue-100 text-blue-800 border-blue-200";
            case "DISTRIBUTION":
                return "bg-green-100 text-green-800 border-green-200";
            case "STORAGE":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getLocationTypeIcon = (type: string) => {
        switch (type) {
            case "MAIN":
                return <BuildingOfficeIcon className="h-3 w-3 mr-1" />;
            case "SECONDARY":
                return <HomeIcon className="h-3 w-3 mr-1" />;
            case "DISTRIBUTION":
                return <TruckIcon className="h-3 w-3 mr-1" />;
            case "STORAGE":
                return <BuildingOfficeIcon className="h-3 w-3 mr-1" />;
            default:
                return <MapPinIcon className="h-3 w-3 mr-1" />;
        }
    };

    const columns: ColumnDef<Warehouse>[] = [
        {
            key: "code",
            label: "Code",
            sortable: true,
            render: (warehouse) => (
                <span className="text-xs font-mono text-gray-600">{warehouse.code}</span>
            ),
        },
        {
            key: "name",
            label: "Warehouse Name",
            sortable: true,
            render: (warehouse) => (
                <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                        <BuildingOfficeIcon className="h-3.5 w-3.5 text-cyan-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 leading-tight">{warehouse.name}</span>
                </div>
            ),
        },
        {
            key: "locationType",
            label: "Location Type",
            sortable: true,
            render: (warehouse) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getLocationTypeColor(warehouse.locationType)}`}>
                    {getLocationTypeIcon(warehouse.locationType)}
                    {warehouse.locationType}
                </span>
            ),
        },
        {
            key: "address",
            label: "Address",
            sortable: true,
            render: (warehouse) => (
                <span className="text-xs text-gray-600">{warehouse.address || "-"}</span>
            ),
        },
        {
            key: "city",
            label: "City",
            sortable: true,
            render: (warehouse) => (
                <span className="text-xs text-gray-600">{warehouse.city || "-"}</span>
            ),
        },
        {
            key: "isActive",
            label: "Status",
            sortable: true,
            render: (warehouse) => warehouse.isActive !== false ? (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    Active
                </span>
            ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600">
                    <XCircleIcon className="h-3 w-3 mr-1" />
                    Inactive
                </span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "!text-right pr-8",
            className: "text-right",
            render: (warehouse) => (
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedWarehouse(warehouse);
                            setViewModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                        title="View Details"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleEdit(warehouse)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
                        title="Edit Warehouse"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => promptDelete(warehouse)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        title="Delete Warehouse"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title="Warehouses" description="Manage your warehouses and storage locations" />
            <PageBreadcrumb pageTitle="Warehouses" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <AddButton onClick={openCreateWarehouse} label="Add Warehouse" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Warehouses" value={totalWarehouses} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
                    <StatsCard label="Main Warehouses" value={mainWarehouses} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
                    <StatsCard label="Secondary" value={secondaryWarehouses} gradient="from-blue-50 to-indigo-50" borderColor="border-blue-100" labelColor="text-blue-600" />
                    <StatsCard label="Distribution / Storage" value={distributionWarehouses + storageWarehouses} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location Type</label>
                                <select
                                    value={locationTypeFilter}
                                    onChange={e => setLocationTypeFilter(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Types</option>
                                    <option value="MAIN">Main</option>
                                    <option value="SECONDARY">Secondary</option>
                                    <option value="DISTRIBUTION">Distribution</option>
                                    <option value="STORAGE">Storage</option>
                                </select>
                            </div>
                            {locationTypeFilter && (
                                <button
                                    onClick={() => setLocationTypeFilter("")}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4 mt-4">
                            <button
                                onClick={applyFilters}
                                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                            >
                                Apply Filters
                            </button>
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                )}

                {/* Warehouse Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={clearForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                {editingId ? "Edit Warehouse" : "Add New Warehouse"}
                                            </h3>
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Warehouse Code</label>
                                                        <input
                                                            type="text"
                                                            value={form.code}
                                                            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            placeholder="e.g., WH-001"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Warehouse Name</label>
                                                        <input
                                                            type="text"
                                                            value={form.name}
                                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Location Type</label>
                                                    <select
                                                        value={form.locationType}
                                                        onChange={e => setForm({ ...form, locationType: e.target.value as any })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    >
                                                        <option value="MAIN">Main Warehouse</option>
                                                        <option value="SECONDARY">Secondary Warehouse</option>
                                                        <option value="DISTRIBUTION">Distribution Center</option>
                                                        <option value="STORAGE">Storage Facility</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Address</label>
                                                        <input
                                                            type="text"
                                                            value={form.address}
                                                            onChange={e => setForm({ ...form, address: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            placeholder="Street address"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">City</label>
                                                        <input
                                                            type="text"
                                                            value={form.city}
                                                            onChange={e => setForm({ ...form, city: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">State</label>
                                                        <input
                                                            type="text"
                                                            value={form.state}
                                                            onChange={e => setForm({ ...form, state: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Pincode</label>
                                                        <input
                                                            type="text"
                                                            value={form.pincode}
                                                            onChange={e => setForm({ ...form, pincode: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                                                        <input
                                                            type="tel"
                                                            value={form.phone}
                                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Email</label>
                                                        <input
                                                            type="email"
                                                            value={form.email}
                                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.isActive}
                                                            onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                                            className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 mr-2"
                                                        />
                                                        <span className="text-sm text-gray-700">Active</span>
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
                    <ReusableTable<Warehouse>
                        data={filtered}
                        columns={columns}
                        searchable
                        searchPlaceholder="Search by code, name, or city..."
                        searchFields={["code", "name", "city"]}
                        pageSize={PAGE_SIZE}
                        defaultSortKey="name"
                        toolbar={
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                        disabled={warehouses.length === 0}
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
                                <button onClick={() => window.print()} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors" disabled={warehouses.length === 0}>
                                    <PrinterIcon className="h-5 w-5 text-gray-600" />
                                </button>
                                <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border ${showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"}`}>
                                    <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
                                </button>
                                <button onClick={fetchWarehouses} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                                    <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                        }
                        emptyState={
                            <div className="flex flex-col items-center py-4">
                                <div className="h-14 w-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <BuildingOfficeIcon className="h-7 w-7 text-gray-400" />
                                </div>
                                <p className="text-gray-500 text-sm font-medium mb-1.5">No warehouses found</p>
                                <button onClick={openCreateWarehouse} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                                    Add your first warehouse
                                </button>
                            </div>
                        }
                    />
                )}

                {/* View Details Modal */}
                {viewModalOpen && selectedWarehouse && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Warehouse Details
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
                                                        <p className="text-xs text-gray-500">Code</p>
                                                        <p className="text-sm font-mono font-medium text-gray-900">{selectedWarehouse.code}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Name</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedWarehouse.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Location Type</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${getLocationTypeColor(selectedWarehouse.locationType)}`}>
                                                            {getLocationTypeIcon(selectedWarehouse.locationType)}
                                                            {selectedWarehouse.locationType}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Status</p>
                                                        {selectedWarehouse.isActive !== false ? (
                                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 mt-1">
                                                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 mt-1">
                                                                <XCircleIcon className="h-3 w-3 mr-1" />
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                    {selectedWarehouse.address && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Address</p>
                                                            <p className="text-sm text-gray-700">{selectedWarehouse.address}</p>
                                                        </div>
                                                    )}
                                                    {(selectedWarehouse.city || selectedWarehouse.state || selectedWarehouse.pincode) && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Location</p>
                                                            <p className="text-sm text-gray-700">
                                                                {[selectedWarehouse.city, selectedWarehouse.state, selectedWarehouse.pincode].filter(Boolean).join(", ")}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {selectedWarehouse.phone && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Phone</p>
                                                            <p className="text-sm text-gray-700">{selectedWarehouse.phone}</p>
                                                        </div>
                                                    )}
                                                    {selectedWarehouse.email && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Email</p>
                                                            <p className="text-sm text-gray-700">{selectedWarehouse.email}</p>
                                                        </div>
                                                    )}
                                                    {selectedWarehouse.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Created At</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedWarehouse.createdAt).toLocaleString()}</p>
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
                                            handleEdit(selectedWarehouse);
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
                    innerText="Delete Warehouse"
                    subText={deletingWarehouse ? `Are you sure you want to delete warehouse "${deletingWarehouse.name}"? This action cannot be undone.` : "Are you sure you want to delete this warehouse?"}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={confirmDelete}
                    onCancel={() => setDeletingWarehouse(null)}
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                />
            </div>
        </>
    );
};

export default WarehousePage;
