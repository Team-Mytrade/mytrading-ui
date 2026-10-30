import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    EllipsisVerticalIcon,
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
    PrinterIcon,
    DocumentTextIcon,
    ChartBarIcon,
    ClockIcon,
    BriefcaseIcon,
    CheckIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { formatDate, formatDateTime } from "../../company/format";

import { t } from "../../i18n/i18n";
import { stampCompany } from "../../company/pdfStamp";
import { brandShade } from "../../company/brand";
type LeaveRequest = {
    id: number;
    employeeId: string;
    employeeName?: string;
    employeeCode?: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: "Pending" | "Approved" | "Rejected";
    days: number;
    remarks?: string;
    createdAt?: string;
    updatedAt?: string;
};

const API_URL = "/v1/api/payroll/leave-requests";
const PAGE_SIZE = 10;

const LeaveRequestsPage: React.FC = () => {
  // Approving or rejecting is a PATCH of the request (HRM:UPDATE)
  const { canExport, canUpdate } = usePermissions();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof LeaveRequest>("startDate");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
    const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("");
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
    const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
    const [remarks, setRemarks] = useState("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL);
            setRequests(response.data);
        } catch (err) {
            console.error("Error loading leave requests:", err);
            ToasterService.error("Failed to load leave requests");
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        if (!selectedRequest || !actionType) return;
        
        const status = actionType === "APPROVE" ? "Approved" : "Rejected";
        const message = actionType === "APPROVE" ? "approve" : "reject";
        
        const ok = await confirm({
            message: `Are you sure you want to ${message} this leave request for ${selectedRequest.employeeName}?`,
            confirmLabel: actionType === "APPROVE" ? "Approve" : "Reject",
            variant: actionType === "APPROVE" ? "info" : "danger",
        });
        if (!ok) return;
        
        try {
            await axios.patch(`${API_URL}/${selectedRequest.id}`, { 
                status, 
                remarks: remarks || undefined 
            });
            ToasterService.success(`Leave request ${message}d successfully`);
            await fetchRequests();
            setSelectedRequest(null);
            setActionType(null);
            setRemarks("");
            setViewModalOpen(false);
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || `Failed to ${message} request`);
        }
    };

    const exportPDF = async () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Leave Requests Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatDate(new Date())}`, 14, 22);
        doc.text(`Total Requests: ${filtered.length}`, 14, 28);
        
        autoTable(doc, {
            head: [["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status"]],
            body: filtered.map(r => [
                r.employeeName || r.employeeId,
                r.leaveType,
                formatDate(r.startDate),
                formatDate(r.endDate),
                r.days.toString(),
                r.status
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: brandShade(600) },
        });
        await stampCompany(doc);
        doc.save(`Leave_Requests_${todayIso()}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
            'Employee Name': r.employeeName || r.employeeId,
            'Employee Code': r.employeeCode || "",
            'Leave Type': r.leaveType,
            'Start Date': formatDate(r.startDate),
            'End Date': formatDate(r.endDate),
            'Days': r.days,
            'Reason': r.reason,
            'Status': r.status,
            'Remarks': r.remarks || "",
            'Created At': r.createdAt ? formatDate(r.createdAt) : "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leave Requests");
        XLSX.writeFile(wb, `Leave_Requests_${todayIso()}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = useMemo(() => {
        return requests.filter(r => {
            const matchesSearch = (r.employeeName || r.employeeId || "").toLowerCase().includes(search.toLowerCase()) ||
                r.leaveType.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === "All" || r.status === statusFilter;
            const matchesLeaveType = leaveTypeFilter ? r.leaveType === leaveTypeFilter : true;
            return matchesSearch && matchesStatus && matchesLeaveType;
        });
    }, [requests, search, statusFilter, leaveTypeFilter]);

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

    const handleSort = (field: keyof LeaveRequest) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof LeaveRequest }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    // Calculate stats from real data
    const pendingCount = requests.filter(r => r.status === "Pending").length;
    const approvedCount = requests.filter(r => r.status === "Approved").length;
    const rejectedCount = requests.filter(r => r.status === "Rejected").length;
    const totalDays = requests.reduce((sum, r) => sum + r.days, 0);
    
    // Get unique leave types for filter
    const uniqueLeaveTypes = [...new Set(requests.map(r => r.leaveType))];

    // Status badge colors
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Approved":
                return "bg-green-100 text-green-800 border-green-200";
            case "Pending":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "Rejected":
                return "bg-red-100 text-red-800 border-red-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Approved":
                return <CheckCircleIcon className="h-3 w-3 mr-1" />;
            case "Pending":
                return <ClockIcon className="h-3 w-3 mr-1" />;
            case "Rejected":
                return <XCircleIcon className="h-3 w-3 mr-1" />;
            default:
                return null;
        }
    };

    return (
        <>
            <PageMeta title={t("Leave Requests")} description="Manage employee leave requests and approvals" />
            <PageBreadcrumb pageTitle="Approval Queue" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{t("Total Requests")}</p>
                                <p className="text-2xl font-semibold text-gray-900">{requests.length}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{t("Pending")}</p>
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
                                <p className="text-sm text-gray-600">{t("Approved")}</p>
                                <p className="text-2xl font-semibold text-green-600">{approvedCount}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <CheckCircleIcon className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{t("Total Days")}</p>
                                <p className="text-2xl font-semibold text-purple-600">{totalDays}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-full">
                                <CalendarIcon className="h-6 w-6 text-purple-600" />
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
                                placeholder={t("Search by employee or leave type...")}
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Export Menu */}
                        <div className="relative">
                            {canExport && (<button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                disabled={requests.length === 0}
                            >
                                <DocumentArrowDownIcon className="h-5 w-5 text-gray-600" />
                            </button>)}

                            {showExportMenu && (
                                <div className="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                    <button
                                        onClick={exportPDF}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                        {t("Export PDF")}
                                    </button>
                                    <button
                                        onClick={exportExcel}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <TableCellsIcon className="h-4 w-4 text-green-600" />
                                        {t("Export Excel")}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Print Button */}
                        <button
                            onClick={() => window.print()}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                            disabled={requests.length === 0}
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
                            onClick={fetchRequests}
                            className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors ${loading ? 'animate-spin' : ''}`}
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Status")}</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">{t("All Status")}</option>
                                    <option value="Pending">{t("Pending")}</option>
                                    <option value="Approved">{t("Approved")}</option>
                                    <option value="Rejected">{t("Rejected")}</option>
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Leave Type")}</label>
                                <select
                                    value={leaveTypeFilter}
                                    onChange={e => { setLeaveTypeFilter(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">{t("All Types")}</option>
                                    {uniqueLeaveTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            {(statusFilter !== "All" || leaveTypeFilter) && (
                                <button
                                    onClick={() => {
                                        setStatusFilter("All");
                                        setLeaveTypeFilter("");
                                    }}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    {t("Clear Filters")}
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
                                        { key: "employeeName", label: "Employee" },
                                        { key: "leaveType", label: "Leave Type" },
                                        { key: "startDate", label: "Start Date" },
                                        { key: "endDate", label: "End Date" },
                                        { key: "days", label: "Days" },
                                        { key: "status", label: "Status" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof LeaveRequest)}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof LeaveRequest} />}
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
                                                <p className="text-gray-500 text-sm">{t("Loading leave requests...")}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(request => (
                                    <tr
                                        key={request.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <span className="text-xs font-medium text-cyan-700">
                                                        {request.employeeName?.charAt(0) || request.employeeId?.charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {request.employeeName || request.employeeId}
                                                    </div>
                                                    {request.employeeCode && (
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {request.employeeCode}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                                <BriefcaseIcon className="h-3 w-3 mr-1" />
                                                {request.leaveType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-900">
                                                    {formatDate(request.startDate)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-900">
                                                    {formatDate(request.endDate)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{request.days}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(request.status)}`}>
                                                {getStatusIcon(request.status)}
                                                {request.status}
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
                                                                    setSelectedRequest(request);
                                                                    setViewModalOpen(true);
                                                                }}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                            >
                                                                <EyeIcon className="h-4 w-4 text-blue-600" />
                                                                {t("View Details")}
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    {request.status === "Pending" && canUpdate && (
                                                        <>
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedRequest(request);
                                                                            setActionType("APPROVE");
                                                                            setRemarks("");
                                                                        }}
                                                                        className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-green-600`}
                                                                    >
                                                                        <CheckCircleIcon className="h-4 w-4" />
                                                                        {t("Approve")}
                                                                    </button>
                                                                )}
                                                            </Menu.Item>
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedRequest(request);
                                                                            setActionType("REJECT");
                                                                            setRemarks("");
                                                                        }}
                                                                        className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600`}
                                                                    >
                                                                        <XCircleIcon className="h-4 w-4" />
                                                                        {t("Reject")}
                                                                    </button>
                                                                )}
                                                            </Menu.Item>
                                                        </>
                                                    )}
                                                </Menu.Items>
                                            </Menu>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">{t("No leave requests found")}</p>
                                                <p className="text-gray-400 text-xs">{t("Try adjusting your search or filters")}</p>
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
                                    {t("Previous")}
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t("Next")}
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        {t("Showing")} <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> {t("to")}{' '}
                                        <span className="font-medium">
                                            {Math.min(page * PAGE_SIZE, filtered.length)}
                                        </span>{' '}
                                        of <span className="font-medium">{filtered.length}</span> {t("results")}
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label={t("Pagination")}>
                                        <button
                                            onClick={() => setPage(1)}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {t("First")}
                                        </button>
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {t("Previous")}
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
                                            {t("Next")}
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {t("Last")}
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* View Details Modal */}
                {viewModalOpen && selectedRequest && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    {t("Leave Request Details")}
                                                </h3>
                                                <button
                                                    onClick={() => setViewModalOpen(false)}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>
                                            
                                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">{t("Employee Information")}</h4>
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <span className="text-gray-500">{t("Name:")}</span>
                                                    <span className="font-medium">{selectedRequest.employeeName || selectedRequest.employeeId}</span>
                                                    <span className="text-gray-500">{t("Employee Code:")}</span>
                                                    <span className="font-medium">{selectedRequest.employeeCode || "—"}</span>
                                                    <span className="text-gray-500">{t("Leave Type:")}</span>
                                                    <span className="font-medium">{selectedRequest.leaveType}</span>
                                                    <span className="text-gray-500">{t("Status:")}</span>
                                                    <span className={`font-medium ${selectedRequest.status === "Approved" ? "text-green-600" : selectedRequest.status === "Pending" ? "text-yellow-600" : "text-red-600"}`}>
                                                        {selectedRequest.status}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">{t("Leave Period")}</h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">{t("Start Date:")}</span>
                                                        <span className="font-medium">{formatDate(selectedRequest.startDate)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">{t("End Date:")}</span>
                                                        <span className="font-medium">{formatDate(selectedRequest.endDate)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">{t("Total Days:")}</span>
                                                        <span className="font-medium">{selectedRequest.days}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">{t("Reason")}</h4>
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-700">{selectedRequest.reason || "No reason provided"}</p>
                                                </div>
                                            </div>

                                            {selectedRequest.remarks && (
                                                <div className="mb-6">
                                                    <h4 className="text-sm font-medium text-gray-700 mb-2">{t("Remarks")}</h4>
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-700">{selectedRequest.remarks}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedRequest.createdAt && (
                                                <div className="text-xs text-gray-400 mt-4">
                                                    {t("Created:")} {formatDateTime(selectedRequest.createdAt)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    {selectedRequest.status === "Pending" && canUpdate && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewModalOpen(false);
                                                    setActionType("APPROVE");
                                                    setRemarks("");
                                                }}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                                            >
                                                <CheckCircleIcon className="h-4 w-4 mr-2" />
                                                {t("Approve")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewModalOpen(false);
                                                    setActionType("REJECT");
                                                    setRemarks("");
                                                }}
                                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                            >
                                                <XCircleIcon className="h-4 w-4 mr-2" />
                                                {t("Reject")}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setViewModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:w-auto sm:text-sm"
                                    >
                                        {t("Close")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Modal (Approve/Reject) */}
                {selectedRequest && actionType && !viewModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => {
                                setSelectedRequest(null);
                                setActionType(null);
                            }}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                {actionType === "APPROVE" ? "Approve Leave Request" : "Reject Leave Request"}
                                            </h3>
                                            
                                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                                <div className="text-sm">
                                                    <p><span className="font-medium">{t("Employee:")}</span> {selectedRequest.employeeName || selectedRequest.employeeId}</p>
                                                    <p><span className="font-medium">{t("Leave Type:")}</span> {selectedRequest.leaveType}</p>
                                                    <p><span className="font-medium">{t("Duration:")}</span> {formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}</p>
                                                    <p><span className="font-medium">{t("Days:")}</span> {selectedRequest.days}</p>
                                                    <p className="mt-2"><span className="font-medium">{t("Reason:")}</span> {selectedRequest.reason}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t("Remarks (Optional)")}
                                                </label>
                                                <textarea
                                                    className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-cyan-500 focus:border-cyan-500"
                                                    rows={3}
                                                    placeholder={actionType === "APPROVE" ? "Add any approval notes..." : "Reason for rejection..."}
                                                    value={remarks}
                                                    onChange={(e) => setRemarks(e.target.value)}
                                                ></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={handleAction}
                                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${actionType === "APPROVE"
                                                ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                                                : "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                                            }`}
                                    >
                                        {actionType === "APPROVE" ? "Approve" : "Reject"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedRequest(null);
                                            setActionType(null);
                                            setRemarks("");
                                        }}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {t("Cancel")}
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

export default LeaveRequestsPage;