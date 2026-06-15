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
    PlusIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    BanknotesIcon,
    CalendarIcon,
    PrinterIcon,
    DocumentTextIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    ClockIcon,
    WalletIcon,
    BriefcaseIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

type TaxDeduction = {
    id: number;
    employeeId: string;
    employeeName?: string;
    employeeCode?: string;
    deductionType: string;
    amount: number;
    effectiveDate: string;
    remarks: string;
    status: 'Verified' | 'Pending' | 'Flagged';
    createdAt?: string;
    updatedAt?: string;
};

const API_URL = "/v1/api/payroll/tax-deductions";
const PAGE_SIZE = 10;

const PayrollTaxDeductionsPage: React.FC = () => {
    const [deductions, setDeductions] = useState<TaxDeduction[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof TaxDeduction>("effectiveDate");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingDeduction, setEditingDeduction] = useState<TaxDeduction | null>(null);
    const [statusFilter, setStatusFilter] = useState<"All" | "Verified" | "Pending" | "Flagged">("All");
    const [deductionTypeFilter, setDeductionTypeFilter] = useState<string>("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDeduction, setSelectedDeduction] = useState<TaxDeduction | null>(null);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const [form, setForm] = useState<Omit<TaxDeduction, "id" | "status">>({
        employeeId: "",
        deductionType: "",
        amount: 0,
        effectiveDate: new Date().toISOString().split('T')[0],
        remarks: "",
    });

    useEffect(() => {
        fetchDeductions();
    }, []);

    const fetchDeductions = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL);
            setDeductions(response.data);
        } catch (err) {
            console.error("Error loading tax deductions:", err);
            ToasterService.error("Failed to load tax deductions");
            setDeductions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            if (editingDeduction) {
                await axios.put(`${API_URL}/${editingDeduction.id}`, form);
                ToasterService.success("Tax deduction updated successfully");
            } else {
                await axios.post(API_URL, form);
                ToasterService.success("Tax deduction created successfully");
            }
            await fetchDeductions();
            closeForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const handleDelete = async (id: number, employeeName: string) => {
        const ok = await confirm({
            message: `Are you sure you want to delete this tax deduction record for ${employeeName}? This action cannot be undone.`,
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;
        
        try {
            await axios.delete(`${API_URL}/${id}`);
            ToasterService.success("Tax deduction deleted successfully");
            await fetchDeductions();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingDeduction(null);
        setForm({ 
            employeeId: "", 
            deductionType: "", 
            amount: 0, 
            effectiveDate: new Date().toISOString().split('T')[0], 
            remarks: "" 
        });
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Tax Deductions Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Records: ${filtered.length}`, 14, 28);
        
        autoTable(doc, {
            head: [["Employee", "Deduction Type", "Amount", "Effective Date", "Status"]],
            body: filtered.map(d => [
                d.employeeName || d.employeeId,
                d.deductionType,
                `₹${d.amount.toLocaleString()}`,
                new Date(d.effectiveDate).toLocaleDateString(),
                d.status
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Tax_Deductions_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(d => ({
            'Employee Name': d.employeeName || d.employeeId,
            'Employee Code': d.employeeCode || "",
            'Deduction Type': d.deductionType,
            'Amount': d.amount,
            'Effective Date': new Date(d.effectiveDate).toLocaleDateString(),
            'Status': d.status,
            'Remarks': d.remarks,
            'Created At': d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tax Deductions");
        XLSX.writeFile(wb, `Tax_Deductions_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = useMemo(() => {
        return deductions.filter(d => {
            const matchesSearch = 
                (d.employeeName || d.employeeId || "").toLowerCase().includes(search.toLowerCase()) ||
                d.deductionType.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === "All" || d.status === statusFilter;
            const matchesType = deductionTypeFilter ? d.deductionType === deductionTypeFilter : true;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [deductions, search, statusFilter, deductionTypeFilter]);

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

    const handleSort = (field: keyof TaxDeduction) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof TaxDeduction }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    // Calculate stats from real data
    const totalAmount = deductions.reduce((sum, d) => sum + d.amount, 0);
    const verifiedCount = deductions.filter(d => d.status === "Verified").length;
    const pendingCount = deductions.filter(d => d.status === "Pending").length;
    const flaggedCount = deductions.filter(d => d.status === "Flagged").length;
    
    // Get unique deduction types for filter
    const uniqueTypes = [...new Set(deductions.map(d => d.deductionType))];

    // Status badge configuration
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Verified":
                return "bg-green-100 text-green-800 border-green-200";
            case "Pending":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "Flagged":
                return "bg-red-100 text-red-800 border-red-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Verified":
                return <CheckCircleIcon className="h-3 w-3 mr-1" />;
            case "Pending":
                return <ClockIcon className="h-3 w-3 mr-1" />;
            case "Flagged":
                return 'Alert';
            default:
                return null;
        }
    };

    return (
        <>
            <PageMeta title="Tax Deductions" description="Manage statutory deductions and tax compliance" />
            <PageBreadcrumb pageTitle="Statutory Auditor" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Deductions</p>
                                <p className="text-2xl font-semibold text-gray-900">{deductions.length}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Amount</p>
                                <p className="text-2xl font-semibold text-green-600">₹{(totalAmount / 1000).toFixed(1)}K</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Verified</p>
                                <p className="text-2xl font-semibold text-emerald-600">{verifiedCount}</p>
                            </div>
                            <div className="p-3 bg-emerald-100 rounded-full">
                                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending / Flagged</p>
                                <p className="text-2xl font-semibold text-amber-600">{pendingCount + flaggedCount}</p>
                            </div>
                            <div className="p-3 bg-amber-100 rounded-full">
                                <ClockIcon className="h-6 w-6 text-amber-600" />
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
                                placeholder="Search by employee or deduction type..."
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
                                disabled={deductions.length === 0}
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
                            disabled={deductions.length === 0}
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
                            onClick={fetchDeductions}
                            className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors ${loading ? 'animate-spin' : ''}`}
                        >
                            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>

                        {/* Add Button */}
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-4 !mb-0 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
                        >
                            <PlusIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Add Deduction</span>
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Verified">Verified</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Flagged">Flagged</option>
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deduction Type</label>
                                <select
                                    value={deductionTypeFilter}
                                    onChange={e => { setDeductionTypeFilter(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Types</option>
                                    {uniqueTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            {(statusFilter !== "All" || deductionTypeFilter) && (
                                <button
                                    onClick={() => {
                                        setStatusFilter("All");
                                        setDeductionTypeFilter("");
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
                                        { key: "employeeName", label: "Employee" },
                                        { key: "deductionType", label: "Deduction Type" },
                                        { key: "amount", label: "Amount" },
                                        { key: "effectiveDate", label: "Effective Date" },
                                        { key: "status", label: "Status" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof TaxDeduction)}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof TaxDeduction} />}
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
                                                <p className="text-gray-500 text-sm">Loading tax deductions...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(deduction => (
                                    <tr
                                        key={deduction.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <span className="text-xs font-medium text-cyan-700">
                                                        {deduction.employeeName?.charAt(0) || deduction.employeeId?.charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {deduction.employeeName || deduction.employeeId}
                                                    </div>
                                                    {deduction.employeeCode && (
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {deduction.employeeCode}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                                <ShieldCheckIcon className="h-3 w-3 mr-1" />
                                                {deduction.deductionType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">₹{deduction.amount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-900">
                                                    {new Date(deduction.effectiveDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(deduction.status)}`}>
                                                {getStatusIcon(deduction.status)}
                                                {deduction.status}
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
                                                                    setSelectedDeduction(deduction);
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
                                                                onClick={() => {
                                                                    setEditingDeduction(deduction);
                                                                    setForm({ ...deduction });
                                                                    setShowForm(true);
                                                                }}
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
                                                                onClick={() => handleDelete(deduction.id, deduction.employeeName || deduction.employeeId)}
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
                                                <BanknotesIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No tax deductions found</p>
                                                <p className="text-gray-400 text-xs">Click "Add Deduction" to create one</p>
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
                {viewModalOpen && selectedDeduction && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Tax Deduction Details
                                                </h3>
                                                <button
                                                    onClick={() => setViewModalOpen(false)}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>
                                            
                                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Employee Information</h4>
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <span className="text-gray-500">Name:</span>
                                                    <span className="font-medium">{selectedDeduction.employeeName || selectedDeduction.employeeId}</span>
                                                    <span className="text-gray-500">Employee Code:</span>
                                                    <span className="font-medium">{selectedDeduction.employeeCode || "—"}</span>
                                                    <span className="text-gray-500">Deduction Type:</span>
                                                    <span className="font-medium">{selectedDeduction.deductionType}</span>
                                                    <span className="text-gray-500">Status:</span>
                                                    <span className={`font-medium ${
                                                        selectedDeduction.status === "Verified" ? "text-green-600" :
                                                        selectedDeduction.status === "Pending" ? "text-yellow-600" : "text-red-600"
                                                    }`}>
                                                        {selectedDeduction.status}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Deduction Details</h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">Amount:</span>
                                                        <span className="font-bold text-gray-900">₹{selectedDeduction.amount.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">Effective Date:</span>
                                                        <span className="font-medium">{new Date(selectedDeduction.effectiveDate).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedDeduction.remarks && (
                                                <div className="mb-6">
                                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Remarks</h4>
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-700">{selectedDeduction.remarks}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedDeduction.createdAt && (
                                                <div className="text-xs text-gray-400 mt-4">
                                                    Created: {new Date(selectedDeduction.createdAt).toLocaleString()}
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
                                            setEditingDeduction(selectedDeduction);
                                            setForm({ ...selectedDeduction });
                                            setShowForm(true);
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
                                                {editingDeduction ? "Edit Tax Deduction" : "Add Tax Deduction"}
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
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Deduction Type</label>
                                                    <input
                                                        type="text"
                                                        value={form.deductionType}
                                                        onChange={e => setForm({ ...form, deductionType: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                                                    <input
                                                        type="number"
                                                        value={form.amount}
                                                        onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Effective Date</label>
                                                    <input
                                                        type="date"
                                                        value={form.effectiveDate}
                                                        onChange={e => setForm({ ...form, effectiveDate: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Remarks</label>
                                                    <textarea
                                                        value={form.remarks}
                                                        onChange={e => setForm({ ...form, remarks: e.target.value })}
                                                        rows={3}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        placeholder="Optional remarks..."
                                                    />
                                                </div>

                                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                                    <p className="text-sm text-yellow-800">
                                                        <strong>Note:</strong> Statutory entries are subject to quarterly governmental audit. 
                                                        Erasure from historical records requires CFO authorization.
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
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {editingDeduction ? "Update" : "Save"}
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

export default PayrollTaxDeductionsPage;