import { Menu } from "@headlessui/react";
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentArrowDownIcon,
    DocumentTextIcon,
    EllipsisVerticalIcon,
    EyeIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    MapPinIcon,
    PencilSquareIcon,
    PrinterIcon,
    TableCellsIcon,
    TrashIcon,
    TruckIcon,
    UserIcon,
    XCircleIcon
} from "@heroicons/react/24/outline";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { ToasterService } from "../../Services/ToasterService";

interface DeliverySchedule {
    id: number;
    customer: string;
    customerId?: string;
    address: string;
    status: "Pending" | "Shipped" | "Delivered";
    date: string;
    contactNumber?: string;
    email?: string;
    notes?: string;
    trackingNumber?: string;
    createdAt?: string;
    updatedAt?: string;
}

const API_URL = "/v1/api/delivery/schedules";
const PAGE_SIZE = 10;

const DeliverySchedulePage: React.FC = () => {
    const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof DeliverySchedule>("date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<DeliverySchedule | null>(null);
    const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Shipped" | "Delivered">("All");
    const [dateFromFilter, setDateFromFilter] = useState<string>("");
    const [dateToFilter, setDateToFilter] = useState<string>("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<DeliverySchedule | null>(null);
    const [step, setStep] = useState(0);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const [form, setForm] = useState<Partial<DeliverySchedule>>({
        customer: "",
        address: "",
        status: "Pending",
        date: new Date().toISOString().split('T')[0],
        contactNumber: "",
        email: "",
        notes: "",
        trackingNumber: "",
    });

    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL);
            setSchedules(response.data);
        } catch (err) {
            console.error("Failed to load delivery schedules", err);
            ToasterService.error("Failed to load delivery schedules");
            setSchedules([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.customer?.trim()) {
            ToasterService.warning("Please enter customer name");
            return;
        }
        if (!form.address?.trim()) {
            ToasterService.warning("Please enter delivery address");
            return;
        }

        try {
            if (editingSchedule) {
                await axios.put(`${API_URL}/${editingSchedule.id}`, form);
                ToasterService.success("Schedule updated successfully");
            } else {
                await axios.post(API_URL, form);
                ToasterService.success("Schedule created successfully");
            }
            await fetchSchedules();
            closeForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const handleDelete = async (id: number, customer: string) => {
        const ok = await confirm({
            message: `Are you sure you want to delete delivery schedule for "${customer}"? This action cannot be undone.`,
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;

        try {
            await axios.delete(`${API_URL}/${id}`);
            ToasterService.success("Schedule deleted successfully");
            await fetchSchedules();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingSchedule(null);
        setForm({
            customer: "",
            address: "",
            status: "Pending",
            date: new Date().toISOString().split('T')[0],
            contactNumber: "",
            email: "",
            notes: "",
            trackingNumber: "",
        });
        setStep(0);
    };

    const openAdd = () => {
        setEditingSchedule(null);
        setForm({
            customer: "",
            address: "",
            status: "Pending",
            date: new Date().toISOString().split('T')[0],
            contactNumber: "",
            email: "",
            notes: "",
            trackingNumber: "",
        });
        setStep(0);
        setShowForm(true);
    };

    const openEdit = (schedule: DeliverySchedule) => {
        setEditingSchedule(schedule);
        setForm(schedule);
        setStep(0);
        setShowForm(true);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Delivery Schedule Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Schedules: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Customer", "Address", "Status", "Date", "Tracking #"]],
            body: filtered.map(s => [
                s.customer,
                s.address,
                s.status,
                new Date(s.date).toLocaleDateString(),
                s.trackingNumber || "-"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Delivery_Schedules_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(s => ({
            'Customer Name': s.customer,
            'Customer ID': s.customerId || "-",
            'Address': s.address,
            'Status': s.status,
            'Delivery Date': new Date(s.date).toLocaleDateString(),
            'Contact Number': s.contactNumber || "-",
            'Email': s.email || "-",
            'Tracking Number': s.trackingNumber || "-",
            'Notes': s.notes || "-",
            'Created At': s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "-",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Delivery Schedules");
        XLSX.writeFile(wb, `Delivery_Schedules_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const handleSort = (field: keyof DeliverySchedule) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof DeliverySchedule }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    const filtered = useMemo(() => {
        return schedules.filter(s => {
            const matchesSearch = s.customer.toLowerCase().includes(search.toLowerCase()) ||
                s.address.toLowerCase().includes(search.toLowerCase()) ||
                (s.trackingNumber?.toLowerCase().includes(search.toLowerCase()) || false);
            const matchesStatus = statusFilter === "All" || s.status === statusFilter;
            
            let matchesDateRange = true;
            if (dateFromFilter) {
                matchesDateRange = matchesDateRange && new Date(s.date) >= new Date(dateFromFilter);
            }
            if (dateToFilter) {
                matchesDateRange = matchesDateRange && new Date(s.date) <= new Date(dateToFilter);
            }
            
            return matchesSearch && matchesStatus && matchesDateRange;
        });
    }, [schedules, search, statusFilter, dateFromFilter, dateToFilter]);

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (sortKey === "date") {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        }

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
    const totalSchedules = schedules.length;
    const pendingCount = schedules.filter(s => s.status === "Pending").length;
    const shippedCount = schedules.filter(s => s.status === "Shipped").length;
    const deliveredCount = schedules.filter(s => s.status === "Delivered").length;
    const upcomingCount = schedules.filter(s => new Date(s.date) > new Date() && s.status !== "Delivered").length;

    // Status badge configuration
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Delivered":
                return "bg-green-100 text-green-800 border-green-200";
            case "Shipped":
                return "bg-blue-100 text-blue-800 border-blue-200";
            case "Pending":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Delivered":
                return <CheckCircleIcon className="h-3 w-3 mr-1" />;
            case "Shipped":
                return <TruckIcon className="h-3 w-3 mr-1" />;
            case "Pending":
                return <ClockIcon className="h-3 w-3 mr-1" />;
            default:
                return null;
        }
    };

    return (
        <>
            <PageMeta title="Delivery Schedules" description="Manage delivery schedules and tracking" />
            <PageBreadcrumb pageTitle="Delivery Schedules" />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <AddButton label="Add Schedule" onClick={openAdd} />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Schedules</p>
                                <p className="text-2xl font-semibold text-gray-900">{totalSchedules}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending</p>
                                <p className="text-2xl font-semibold text-yellow-600">{pendingCount}</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-full">
                                <ClockIcon className="h-6 w-6 text-yellow-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Shipped</p>
                                <p className="text-2xl font-semibold text-blue-600">{shippedCount}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <TruckIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Delivered / Upcoming</p>
                                <p className="text-2xl font-semibold text-green-600">{deliveredCount} / {upcomingCount}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <CheckCircleIcon className="h-6 w-6 text-green-600" />
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
                                placeholder="Search by customer, address, or tracking #..."
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
                                disabled={schedules.length === 0}
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
                            disabled={schedules.length === 0}
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
                            onClick={fetchSchedules}
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
                            <div className="flex-1 min-w-[150px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Shipped">Shipped</option>
                                    <option value="Delivered">Delivered</option>
                                </select>
                            </div>
                            <div className="flex-1 min-w-[150px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={dateFromFilter}
                                    onChange={e => { setDateFromFilter(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                            <div className="flex-1 min-w-[150px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={dateToFilter}
                                    onChange={e => { setDateToFilter(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                            {(statusFilter !== "All" || dateFromFilter || dateToFilter) && (
                                <button
                                    onClick={() => {
                                        setStatusFilter("All");
                                        setDateFromFilter("");
                                        setDateToFilter("");
                                    }}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filters
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
                                        { key: "customer", label: "Customer" },
                                        { key: "address", label: "Address" },
                                        { key: "status", label: "Status" },
                                        { key: "date", label: "Delivery Date" },
                                        { key: "trackingNumber", label: "Tracking #" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof DeliverySchedule)}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof DeliverySchedule} />}
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
                                                <p className="text-gray-500 text-sm">Loading schedules...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(schedule => (
                                    <tr
                                        key={schedule.id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => {
                                            setSelectedSchedule(schedule);
                                            setViewModalOpen(true);
                                        }}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <UserIcon className="h-4 w-4 text-cyan-600" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{schedule.customer}</div>
                                                    {schedule.customerId && (
                                                        <div className="text-xs text-gray-500 mt-0.5">ID: {schedule.customerId}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <MapPinIcon className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
                                                <span className="text-sm text-gray-700 line-clamp-2 max-w-[250px]">{schedule.address}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(schedule.status)}`}>
                                                {getStatusIcon(schedule.status)}
                                                {schedule.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-600">
                                                    {new Date(schedule.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-mono text-gray-500">{schedule.trackingNumber || "—"}</span>
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
                                                                    setSelectedSchedule(schedule);
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
                                                                onClick={() => openEdit(schedule)}
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
                                                                onClick={() => handleDelete(schedule.id, schedule.customer)}
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
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <TruckIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No delivery schedules found</p>
                                                <p className="text-gray-400 text-xs">Click "Add Schedule" to create one</p>
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
                {viewModalOpen && selectedSchedule && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Delivery Schedule Details
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
                                                        <p className="text-xs text-gray-500">Customer</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedSchedule.customer}</p>
                                                        {selectedSchedule.customerId && (
                                                            <p className="text-xs text-gray-500 mt-1">ID: {selectedSchedule.customerId}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Status</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusBadge(selectedSchedule.status)}`}>
                                                            {getStatusIcon(selectedSchedule.status)}
                                                            {selectedSchedule.status}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500">Delivery Address</p>
                                                        <p className="text-sm text-gray-700">{selectedSchedule.address}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Delivery Date</p>
                                                        <p className="text-sm text-gray-700">{new Date(selectedSchedule.date).toLocaleDateString()}</p>
                                                    </div>
                                                    {selectedSchedule.trackingNumber && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Tracking Number</p>
                                                            <p className="text-sm font-mono text-gray-700">{selectedSchedule.trackingNumber}</p>
                                                        </div>
                                                    )}
                                                    {selectedSchedule.contactNumber && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Contact Number</p>
                                                            <p className="text-sm text-gray-700">{selectedSchedule.contactNumber}</p>
                                                        </div>
                                                    )}
                                                    {selectedSchedule.email && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Email</p>
                                                            <p className="text-sm text-gray-700">{selectedSchedule.email}</p>
                                                        </div>
                                                    )}
                                                    {selectedSchedule.notes && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Notes</p>
                                                            <p className="text-sm text-gray-700">{selectedSchedule.notes}</p>
                                                        </div>
                                                    )}
                                                    {selectedSchedule.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Created At</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedSchedule.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedSchedule.status === "Pending" && new Date(selectedSchedule.date) < new Date() && (
                                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-800">
                                                        <strong>Overdue:</strong> This delivery was scheduled for a past date and is still pending.
                                                    </p>
                                                </div>
                                            )}
                                            {selectedSchedule.status === "Shipped" && selectedSchedule.trackingNumber && (
                                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>Tracking Available:</strong> Use tracking number to monitor delivery status.
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
                                            openEdit(selectedSchedule);
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

                {/* Add/Edit Modal with Stepper */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    {editingSchedule ? "Edit Schedule" : "Add Schedule"}
                                                </h3>
                                                <button
                                                    onClick={closeForm}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            {/* Stepper */}
                                            <div className="flex items-center mb-6">
                                                {["Basic Info", "Details"].map((label, idx) => (
                                                    <div key={idx} className="flex items-center flex-1">
                                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                                                            step === idx ? "bg-cyan-600 text-white" : "bg-gray-200 text-gray-600"
                                                        }`}>
                                                            {idx + 1}
                                                        </div>
                                                        <span className="ml-2 text-xs text-gray-600">{label}</span>
                                                        {idx < 1 && <div className="flex-1 h-0.5 bg-gray-300 mx-2" />}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Step 0: Basic Info */}
                                            {step === 0 && (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Customer Name <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={form.customer || ""}
                                                            onChange={e => setForm({ ...form, customer: e.target.value })}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                            placeholder="Enter customer name"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Delivery Address <span className="text-red-500">*</span>
                                                        </label>
                                                        <textarea
                                                            value={form.address || ""}
                                                            onChange={e => setForm({ ...form, address: e.target.value })}
                                                            rows={3}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                            placeholder="Enter full delivery address"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Contact Number
                                                        </label>
                                                        <input
                                                            type="tel"
                                                            value={form.contactNumber || ""}
                                                            onChange={e => setForm({ ...form, contactNumber: e.target.value })}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                            placeholder="Optional"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Step 1: Details */}
                                            {step === 1 && (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                                        <select
                                                            value={form.status || "Pending"}
                                                            onChange={e => setForm({ ...form, status: e.target.value as any })}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                        >
                                                            <option value="Pending">Pending</option>
                                                            <option value="Shipped">Shipped</option>
                                                            <option value="Delivered">Delivered</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                                                        <input
                                                            type="date"
                                                            value={form.date || ""}
                                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                                                        <input
                                                            type="text"
                                                            value={form.trackingNumber || ""}
                                                            onChange={e => setForm({ ...form, trackingNumber: e.target.value })}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                            placeholder="Optional"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                                        <input
                                                            type="email"
                                                            value={form.email || ""}
                                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                            placeholder="Optional"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                                        <textarea
                                                            value={form.notes || ""}
                                                            onChange={e => setForm({ ...form, notes: e.target.value })}
                                                            rows={2}
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                            placeholder="Additional notes..."
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Footer actions */}
                                            <div className="mt-6 flex justify-between">
                                                {step > 0 ? (
                                                    <button
                                                        onClick={() => setStep(step - 1)}
                                                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors text-gray-700"
                                                    >
                                                        Back
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={closeForm}
                                                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors text-gray-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                {step < 1 ? (
                                                    <button
                                                        onClick={() => setStep(step + 1)}
                                                        className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                                                    >
                                                        Next
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={handleSave}
                                                        className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                                                    >
                                                        Save
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
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

export default DeliverySchedulePage;
