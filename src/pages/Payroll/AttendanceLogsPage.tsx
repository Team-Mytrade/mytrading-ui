import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    PlusIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    UserGroupIcon,
    CalendarIcon,
    ClockIcon,
    PrinterIcon,
    DocumentTextIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { Refresh } from '@mui/icons-material';

type AttendanceLog = {
    id: number;
    employeeId: string;
    employeeName?: string;
    date: string;
    checkIn: string;
    checkOut: string;
    status: 'Present' | 'Absent' | 'Late' | 'Leave';
    source?: 'System' | 'Manual';
    remarks?: string;
    createdAt?: string;
    updatedAt?: string;
};

const API_URL = "/v1/api/payroll/attendance-logs";
const PAGE_SIZE = 10;

const AttendanceLogsPage: React.FC = () => {
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<keyof AttendanceLog>("date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
    const [statusFilter, setStatusFilter] = useState<"All" | "Present" | "Absent" | "Late" | "Leave">("All");
    const [sourceFilter, setSourceFilter] = useState<"All" | "System" | "Manual">("All");
    const [dateRangeFilter, setDateRangeFilter] = useState<{ from: string; to: string }>({ from: "", to: "" });
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const [form, setForm] = useState<Omit<AttendanceLog, 'id'>>({
        employeeId: '',
        date: new Date().toISOString().split('T')[0],
        checkIn: '09:00',
        checkOut: '18:00',
        status: 'Present',
        source: 'Manual',
        remarks: '',
    });

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL);
            setLogs(response.data);
        } catch (err) {
            console.error("Failed to load attendance logs", err);
            ToasterService.error("Failed to load attendance logs");
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingLog) {
                await axios.put(`${API_URL}/${editingLog.id}`, form);
                ToasterService.success("Attendance log updated successfully");
            } else {
                await axios.post(API_URL, form);
                ToasterService.success("Attendance log created successfully");
            }
            await fetchLogs();
            closeForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const openEdit = (log: AttendanceLog) => {
        setForm({
            employeeId: log.employeeId,
            date: log.date.split('T')[0],
            checkIn: log.checkIn,
            checkOut: log.checkOut,
            status: log.status,
            source: log.source || 'Manual',
            remarks: log.remarks || '',
        });
        setEditingLog(log);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingLog(null);
        setForm({
            employeeId: '',
            date: new Date().toISOString().split('T')[0],
            checkIn: '09:00',
            checkOut: '18:00',
            status: 'Present',
            source: 'Manual',
            remarks: '',
        });
    };

    const handleDelete = async (id: number, employeeId: string, date: string) => {
        const ok = await confirm({
            message: `Are you sure you want to delete attendance record for ${employeeId} on ${new Date(date).toLocaleDateString()}? This action cannot be undone.`,
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;

        try {
            await axios.delete(`${API_URL}/${id}`);
            ToasterService.success("Attendance log deleted successfully");
            await fetchLogs();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Attendance Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Records: ${filteredLogs.length}`, 14, 28);

        autoTable(doc, {
            head: [["Employee ID", "Date", "Check In", "Check Out", "Status", "Source"]],
            body: filteredLogs.map(l => [
                l.employeeId,
                new Date(l.date).toLocaleDateString(),
                l.checkIn,
                l.checkOut || "-",
                l.status,
                l.source || "Manual"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Attendance_Report_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredLogs.map(l => ({
            'Employee ID': l.employeeId,
            'Employee Name': l.employeeName || "",
            'Date': new Date(l.date).toLocaleDateString(),
            'Check In': l.checkIn,
            'Check Out': l.checkOut,
            'Status': l.status,
            'Source': l.source || "Manual",
            'Remarks': l.remarks || "",
            'Created At': l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance Logs");
        XLSX.writeFile(wb, `Attendance_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const handleSort = (field: keyof AttendanceLog) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof AttendanceLog }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = log.employeeId.toLowerCase().includes(search.toLowerCase()) ||
                (log.employeeName?.toLowerCase().includes(search.toLowerCase()) || false);
            const matchesStatus = statusFilter === "All" || log.status === statusFilter;
            const matchesSource = sourceFilter === "All" || log.source === sourceFilter;
            
            let matchesDateRange = true;
            if (dateRangeFilter.from) {
                matchesDateRange = matchesDateRange && new Date(log.date) >= new Date(dateRangeFilter.from);
            }
            if (dateRangeFilter.to) {
                matchesDateRange = matchesDateRange && new Date(log.date) <= new Date(dateRangeFilter.to);
            }
            
            return matchesSearch && matchesStatus && matchesSource && matchesDateRange;
        });
    }, [logs, search, statusFilter, sourceFilter, dateRangeFilter]);

    const sorted = [...filteredLogs].sort((a, b) => {
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

    const paginatedLogs = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

    // Calculate stats from real data
    const totalLogs = logs.length;
    const presentCount = logs.filter(l => l.status === "Present").length;
    const absentCount = logs.filter(l => l.status === "Absent").length;
    const lateCount = logs.filter(l => l.status === "Late").length;
    const leaveCount = logs.filter(l => l.status === "Leave").length;
    const systemLogs = logs.filter(l => l.source === "System").length;
    const manualLogs = logs.filter(l => l.source === "Manual").length;

    // Status badge configuration
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Present":
                return "bg-green-100 text-green-800 border-green-200";
            case "Absent":
                return "bg-red-100 text-red-800 border-red-200";
            case "Late":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "Leave":
                return "bg-blue-100 text-blue-800 border-blue-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Present":
                return <CheckCircleIcon className="h-3 w-3 mr-1" />;
            case "Absent":
                return <XCircleIcon className="h-3 w-3 mr-1" />;
            case "Late":
                return <ClockIcon className="h-3 w-3 mr-1" />;
            case "Leave":
                return <CalendarIcon className="h-3 w-3 mr-1" />;
            default:
                return null;
        }
    };

    return (
        <>
            <PageMeta title="Attendance Logs" description="Manage employee attendance records" />
            <PageBreadcrumb pageTitle="Audit Trail" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Records</p>
                                <p className="text-2xl font-semibold text-gray-900">{totalLogs}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Present</p>
                                <p className="text-2xl font-semibold text-green-600">{presentCount}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <CheckCircleIcon className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Absent / Late</p>
                                <p className="text-2xl font-semibold text-yellow-600">{absentCount + lateCount}</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-full">
                                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">System Logs</p>
                                <p className="text-2xl font-semibold text-purple-600">{systemLogs}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-full">
                                <ShieldCheckIcon className="h-6 w-6 text-purple-600" />
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
                                placeholder="Search by Employee ID or Name..."
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
                                disabled={logs.length === 0}
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
                            disabled={logs.length === 0}
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
                            onClick={fetchLogs}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>

                        {/* Add Log Button */}
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-4 !mb-0 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
                        >
                            <PlusIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Add Log</span>
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Present">Present</option>
                                    <option value="Absent">Absent</option>
                                    <option value="Late">Late</option>
                                    <option value="Leave">Leave</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                                <select
                                    value={sourceFilter}
                                    onChange={e => { setSourceFilter(e.target.value as any); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">All Sources</option>
                                    <option value="System">System</option>
                                    <option value="Manual">Manual</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={dateRangeFilter.from}
                                    onChange={e => setDateRangeFilter({ ...dateRangeFilter, from: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={dateRangeFilter.to}
                                    onChange={e => setDateRangeFilter({ ...dateRangeFilter, to: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                        </div>
                        {(statusFilter !== "All" || sourceFilter !== "All" || dateRangeFilter.from || dateRangeFilter.to) && (
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => {
                                        setStatusFilter("All");
                                        setSourceFilter("All");
                                        setDateRangeFilter({ from: "", to: "" });
                                    }}
                                    className="text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear All Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Attendance Table */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        { key: "employeeId", label: "Employee ID" },
                                        { key: "date", label: "Date" },
                                        { key: "checkIn", label: "Check In" },
                                        { key: "checkOut", label: "Check Out" },
                                        { key: "status", label: "Status" },
                                        { key: "source", label: "Source" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof AttendanceLog)}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof AttendanceLog} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                                                <p className="text-gray-500 text-sm">Loading attendance records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedLogs.length > 0 ? paginatedLogs.map(log => (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <span className="text-xs font-medium text-cyan-700">
                                                        {log.employeeId.charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {log.employeeId}
                                                    </div>
                                                    {log.employeeName && (
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {log.employeeName}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-900">
                                                    {new Date(log.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm font-mono text-gray-900">{log.checkIn}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm font-mono text-gray-600">{log.checkOut || "—"}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(log.status)}`}>
                                                {getStatusIcon(log.status)}
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${log.source === 'System' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {log.source === 'System' ? <ShieldCheckIcon className="h-3 w-3 mr-1" /> : <Refresh className="h-3 w-3 mr-1" />}
                                                {log.source || 'Manual'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right relative">
                                            <Menu as="div" className="relative inline-block text-left">
                                                <Menu.Button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                                    <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                                                </Menu.Button>
                                                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]">
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedLog(log);
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
                                                                onClick={() => openEdit(log)}
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
                                                                onClick={() => handleDelete(log.id, log.employeeId, log.date)}
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
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No attendance records found</p>
                                                <p className="text-gray-400 text-xs">Click "Add Log" to create one</p>
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
                                            {Math.min(page * PAGE_SIZE, filteredLogs.length)}
                                        </span>{' '}
                                        of <span className="font-medium">{filteredLogs.length}</span> results
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
                {viewModalOpen && selectedLog && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Attendance Details
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
                                                        <p className="text-xs text-gray-500">Employee ID</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedLog.employeeId}</p>
                                                    </div>
                                                    {selectedLog.employeeName && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Employee Name</p>
                                                            <p className="text-sm text-gray-700">{selectedLog.employeeName}</p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-xs text-gray-500">Date</p>
                                                        <p className="text-sm text-gray-700">{new Date(selectedLog.date).toLocaleDateString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Status</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusBadge(selectedLog.status)}`}>
                                                            {getStatusIcon(selectedLog.status)}
                                                            {selectedLog.status}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Check In</p>
                                                        <p className="text-sm font-mono text-gray-900">{selectedLog.checkIn}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Check Out</p>
                                                        <p className="text-sm font-mono text-gray-600">{selectedLog.checkOut || "—"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Source</p>
                                                        <p className="text-sm text-gray-700">{selectedLog.source || "Manual"}</p>
                                                    </div>
                                                    {selectedLog.remarks && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Remarks</p>
                                                            <p className="text-sm text-gray-700">{selectedLog.remarks}</p>
                                                        </div>
                                                    )}
                                                    {selectedLog.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Record Created</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedLog.status === "Late" && (
                                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                                    <p className="text-sm text-yellow-800">
                                                        <strong>Late Attendance:</strong> Employee arrived after scheduled start time.
                                                    </p>
                                                </div>
                                            )}
                                            {selectedLog.status === "Absent" && (
                                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-800">
                                                        <strong>Absent:</strong> No attendance recorded for this day.
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
                                            openEdit(selectedLog);
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

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                {editingLog ? "Edit Attendance Log" : "Add Attendance Log"}
                                            </h3>
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                                                    <input
                                                        type="text"
                                                        value={form.employeeId}
                                                        onChange={e => setForm({ ...form, employeeId: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Date</label>
                                                        <input
                                                            type="date"
                                                            value={form.date}
                                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Status</label>
                                                        <select
                                                            value={form.status}
                                                            onChange={e => setForm({ ...form, status: e.target.value as any })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        >
                                                            <option value="Present">Present</option>
                                                            <option value="Absent">Absent</option>
                                                            <option value="Late">Late</option>
                                                            <option value="Leave">Leave</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Check In</label>
                                                        <input
                                                            type="time"
                                                            value={form.checkIn}
                                                            onChange={e => setForm({ ...form, checkIn: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Check Out</label>
                                                        <input
                                                            type="time"
                                                            value={form.checkOut}
                                                            onChange={e => setForm({ ...form, checkOut: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Source</label>
                                                    <select
                                                        value={form.source}
                                                        onChange={e => setForm({ ...form, source: e.target.value as any })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                    >
                                                        <option value="Manual">Manual Entry</option>
                                                        <option value="System">System Generated</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Remarks (Optional)</label>
                                                    <textarea
                                                        value={form.remarks}
                                                        onChange={e => setForm({ ...form, remarks: e.target.value })}
                                                        rows={3}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        placeholder="Additional notes..."
                                                    />
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
                                        {editingLog ? "Update" : "Create"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeForm}
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

export default AttendanceLogsPage;