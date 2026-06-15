import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    FunnelIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    BanknotesIcon,
    DocumentDuplicateIcon,
    TagIcon,
    CalendarIcon,
    BuildingOfficeIcon,
    DocumentTextIcon,
    ShareIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";
import { useConfirmDialog } from "../../../hooks/useConfirmDialog";
import ConfirmDialog from "../../../components/common/ConfirmDialog";

const BASE_URL = "/v1/api/invoice/accounts-payable";
const VENDORS_URL = "/v1/api/invoice/vendors";
const PAGE_SIZE = 10;

type Status = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

interface Vendor {
    id: number;
    name: string;
}

interface AccountsPayable {
    id?: number;
    vendor?: Vendor;
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount: number;
    amountPaid: number;
    balance: number;
    accountsPayableStatus: Status;
    lastPaymentDate?: string;
    dueDate: string;
    createdDate?: string;
    updatedDate?: string;
}

const AccountsPayableList: React.FC = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState<AccountsPayable[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof AccountsPayable>("dueDate");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState<number | "">("");
    const [vendorOutstanding, setVendorOutstanding] = useState<number | null>(null);
    const [activeView, setActiveView] = useState<'all' | 'vendor' | 'outstanding'>('all');

    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const loadData = async () => {
        setLoading(true);
        try {
            const [vendorRes] = await Promise.all([
                axios.get(VENDORS_URL)
            ]);
            setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);
        } catch (err) {
            console.error("Error loading data:", err);
            ToasterService.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const loadAllPayables = async () => {
        setLoading(true);
        setActiveView('all');
        setVendorOutstanding(null);
        try {
            const res = await axios.get(BASE_URL);
            setRecords(Array.isArray(res.data) ? res.data : []);
            setPage(1);
            ToasterService.success("All payables loaded");
        } catch (err) {
            console.error("Error loading payables:", err);
            ToasterService.error("Failed to load payables");
        } finally {
            setLoading(false);
        }
    };

    const loadVendorPayables = async () => {
        if (!selectedVendorId) {
            ToasterService.error("Please select a vendor");
            return;
        }

        setLoading(true);
        setActiveView('vendor');
        setVendorOutstanding(null);
        try {
            const res = await axios.get(`${BASE_URL}/vendor/${selectedVendorId}`);
            setRecords(Array.isArray(res.data) ? res.data : []);
            setPage(1);
            ToasterService.success("Vendor payables loaded");
        } catch (err) {
            console.error("Error loading vendor payables:", err);
            ToasterService.error("Failed to load vendor payables");
        } finally {
            setLoading(false);
        }
    };

    const loadVendorOutstanding = async () => {
        if (!selectedVendorId) {
            ToasterService.error("Please select a vendor");
            return;
        }

        setLoading(true);
        setActiveView('outstanding');
        try {
            const res = await axios.get(`${BASE_URL}/vendor/${selectedVendorId}/outstanding`);
            setVendorOutstanding(res.data);

            // Also load the vendor's payables to show in table
            const payablesRes = await axios.get(`${BASE_URL}/vendor/${selectedVendorId}`);
            setRecords(Array.isArray(payablesRes.data) ? payablesRes.data : []);

            setPage(1);
            ToasterService.success("Outstanding balance loaded");
        } catch (err) {
            console.error("Error loading vendor outstanding:", err);
            ToasterService.error("Failed to load vendor outstanding");
        } finally {
            setLoading(false);
        }
    };

    const resetView = () => {
        setActiveView('all');
        setRecords([]);
        setVendorOutstanding(null);
        setSelectedVendorId("");
    };

    const handleDelete = async (id: number) => {
        const ok = await confirm({
            message: "Are you sure you want to delete this payable? This action cannot be undone.",
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;

        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/${id}`);
            ToasterService.success("Payable deleted successfully");

            // Reload based on current view
            if (activeView === 'vendor' && selectedVendorId) {
                await loadVendorPayables();
            } else if (activeView === 'outstanding' && selectedVendorId) {
                await loadVendorOutstanding();
            } else {
                setRecords([]);
            }
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Failed to delete payable");
        } finally {
            setLoading(false);
        }
    };

    const handleMakePayment = async (id: number) => {
        // This would typically open a payment modal
        // For now, navigate to a payment page or open a modal
        navigate(`/accounts-payable/pay/${id}`);
    };

    const exportPDF = async () => {
        if (exporting) return;
        setExporting(true);

        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text("Accounts Payable Report", 14, 15);
            doc.setFontSize(10);

            let title = "All Payables";
            if (activeView === 'vendor' && selectedVendorId) {
                const vendor = vendors.find(v => v.id === selectedVendorId);
                title = `Payables for ${vendor?.name || 'Vendor'}`;
            } else if (activeView === 'outstanding' && selectedVendorId) {
                const vendor = vendors.find(v => v.id === selectedVendorId);
                title = `Outstanding Payables for ${vendor?.name || 'Vendor'}`;
            }

            doc.text(title, 14, 22);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

            autoTable(doc, {
                head: [["Invoice #", "Vendor", "Due Date", "Amount", "Paid", "Balance", "Status"]],
                body: records.map(r => [
                    r.invoiceNumber || 'N/A',
                    r.vendor?.name || 'N/A',
                    new Date(r.dueDate).toLocaleDateString(),
                    r.invoiceAmount.toFixed(2),
                    r.amountPaid.toFixed(2),
                    r.balance.toFixed(2),
                    r.accountsPayableStatus
                ]),
                startY: 38,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] }
            });

            // Add outstanding summary if available
            if (vendorOutstanding !== null && selectedVendorId) {
                const vendor = vendors.find(v => v.id === selectedVendorId);
                autoTable(doc, {
                    body: [
                        ["Vendor:", vendor?.name || ''],
                        ["Total Outstanding:", `$${vendorOutstanding.toFixed(2)}`]
                    ],
                    startY: (doc as any).lastAutoTable.finalY + 10,
                    styles: { fontSize: 8 },
                    theme: 'plain'
                });
            }

            doc.save(`Payables_${activeView}_${new Date().toISOString().split('T')[0]}.pdf`);
            ToasterService.success("PDF exported successfully");
        } catch (err) {
            console.error("Error exporting PDF:", err);
            ToasterService.error("Failed to export PDF");
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    const exportExcel = async () => {
        if (exporting) return;
        setExporting(true);

        try {
            const data = records.map(r => ({
                "Invoice #": r.invoiceNumber || 'N/A',
                "Vendor": r.vendor?.name || 'N/A',
                "Due Date": r.dueDate,
                "Invoice Amount": r.invoiceAmount,
                "Amount Paid": r.amountPaid,
                "Balance": r.balance,
                "Status": r.accountsPayableStatus
            }));

            // Add outstanding summary if available
            if (vendorOutstanding !== null && selectedVendorId) {
                const vendor = vendors.find(v => v.id === selectedVendorId);
                data.push({} as any);
                data.push({ "Invoice #": "SUMMARY", "Vendor": "Vendor", "Balance": vendor?.name } as any);
                data.push({ "Invoice #": "SUMMARY", "Vendor": "Total Outstanding", "Balance": vendorOutstanding } as any);
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Payables");
            XLSX.writeFile(wb, `Payables_${activeView}_${new Date().toISOString().split('T')[0]}.xlsx`);
            ToasterService.success("Excel exported successfully");
        } catch (err) {
            console.error("Error exporting Excel:", err);
            ToasterService.error("Failed to export Excel");
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    const filtered = records.filter((r) => {
        const matchesSearch = [
            r.invoiceNumber,
            r.vendor?.name,
            r.accountsPayableStatus
        ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus = selectedStatus ? r.accountsPayableStatus === selectedStatus : true;

        return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (sortKey === "dueDate") {
            return sortOrder === "asc"
                ? new Date(valA as string).getTime() - new Date(valB as string).getTime()
                : new Date(valB as string).getTime() - new Date(valA as string).getTime();
        }

        if (sortKey === "invoiceAmount" || sortKey === "amountPaid" || sortKey === "balance") {
            return sortOrder === "asc"
                ? (valA as number) - (valB as number)
                : (valB as number) - (valA as number);
        }

        if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc"
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        }

        return 0;
    });

    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

    const handleSort = (field: keyof AccountsPayable) => {
        if (sortKey === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortKey(field);
            setSortOrder("asc");
        }
    };

    const SortIcon = ({ column }: { column: keyof AccountsPayable }) => {
        if (sortKey !== column) return null;
        return sortOrder === "asc" ?
            <ArrowUpIcon className="h-3 w-3 inline ml-1" /> :
            <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
    };

    const getStatusColor = (status: Status) => {
        switch (status) {
            case "PAID": return "bg-green-100 text-green-800";
            case "PARTIALLY_PAID": return "bg-yellow-100 text-yellow-800";
            case "OPEN": return "bg-blue-100 text-blue-800";
            case "OVERDUE": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getStatusIcon = (status: Status) => {
        switch (status) {
            case "PAID": return <CheckCircleIcon className="h-3 w-3 mr-1" />;
            case "PARTIALLY_PAID": return <BanknotesIcon className="h-3 w-3 mr-1" />;
            case "OPEN": return <ClockIcon className="h-3 w-3 mr-1" />;
            case "OVERDUE": return <ExclamationTriangleIcon className="h-3 w-3 mr-1" />;
            default: return <TagIcon className="h-3 w-3 mr-1" />;
        }
    };

    const totalBalance = records.reduce((sum, r) => sum + r.balance, 0);
    const overdueCount = records.filter(r => r.accountsPayableStatus === "OVERDUE").length;
    const paidCount = records.filter(r => r.accountsPayableStatus === "PAID").length;

    return (
        <>
            <PageMeta title="Accounts Payable" description="Manage accounts payable" />
            <PageBreadcrumb
                pageTitle="Accounts Payable"
                showAddButton
                addButtonLabel="Add Payable"
                onAddClick={() => navigate("/accounts-payable/add")}
            />

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Records</p>
                                <p className="text-2xl font-semibold text-gray-900">{records.length}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Balance</p>
                                <p className="text-2xl font-semibold text-cyan-600">
                                    ${totalBalance.toFixed(2)}
                                </p>
                            </div>
                            <div className="p-3 bg-cyan-100 rounded-full">
                                <BanknotesIcon className="h-6 w-6 text-cyan-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Overdue</p>
                                <p className="text-2xl font-semibold text-red-600">{overdueCount}</p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-full">
                                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Paid</p>
                                <p className="text-2xl font-semibold text-green-600">{paidCount}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <CheckCircleIcon className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vendor Selection and Actions Bar */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Vendor
                            </label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                value={selectedVendorId}
                                onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : "")}
                                disabled={loading || exporting}
                            >
                                <option value="">All Vendors</option>
                                {vendors.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={loadAllPayables}
                                disabled={loading || exporting}
                                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                All Payables
                            </button>
                            <button
                                onClick={loadVendorPayables}
                                disabled={loading || exporting || !selectedVendorId}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Load all payables for selected vendor"
                            >
                                Vendor Payables
                            </button>
                            <button
                                onClick={loadVendorOutstanding}
                                disabled={loading || exporting || !selectedVendorId}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Load outstanding balance for selected vendor"
                            >
                                Outstanding
                            </button>
                            {activeView !== 'all' && (
                                <button
                                    onClick={resetView}
                                    disabled={loading || exporting}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Active View Indicator */}
                    {activeView !== 'all' && (
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">Current View:</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${activeView === 'vendor' ? 'bg-purple-100 text-purple-800' :
                                'bg-orange-100 text-orange-800'
                                }`}>
                                {activeView === 'vendor' ? 'Vendor Payables' : 'Vendor Outstanding'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Vendor Outstanding Summary */}
                {vendorOutstanding !== null && selectedVendorId && (
                    <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-orange-800 flex items-center gap-2">
                                <BanknotesIcon className="h-5 w-5" />
                                Vendor Outstanding Summary
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div className="bg-white p-3 rounded-lg border border-orange-100">
                                <p className="text-xs text-gray-500">Vendor</p>
                                <p className="text-xl font-bold text-orange-600">
                                    {vendors.find(v => v.id === selectedVendorId)?.name}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-orange-100">
                                <p className="text-xs text-gray-500">Total Outstanding</p>
                                <p className="text-xl font-bold text-orange-600">${vendorOutstanding.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search payables..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                disabled={loading || exporting}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                >
                                    <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Export Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                disabled={loading || exporting || records.length === 0}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ShareIcon className="h-5 w-5 text-gray-600" />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                    <button
                                        onClick={exportPDF}
                                        disabled={loading || exporting}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {exporting ? (
                                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                        )}
                                        PDF
                                    </button>
                                    <button
                                        onClick={exportExcel}
                                        disabled={loading || exporting}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {exporting ? (
                                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                                        )}
                                        Excel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            disabled={loading || exporting}
                            className={`p-2 rounded-lg border ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <FunnelIcon className={`h-5 w-5 ${showFilters ? 'text-cyan-600' : 'text-gray-600'}`} />
                        </button>

                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedStatus("")}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedStatus === "" ? 'bg-cyan-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setSelectedStatus("OPEN")}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedStatus === "OPEN" ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        Open
                                    </button>
                                    <button
                                        onClick={() => setSelectedStatus("PARTIALLY_PAID")}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedStatus === "PARTIALLY_PAID" ? 'bg-yellow-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        Partially Paid
                                    </button>
                                    <button
                                        onClick={() => setSelectedStatus("PAID")}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedStatus === "PAID" ? 'bg-green-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        Paid
                                    </button>
                                    <button
                                        onClick={() => setSelectedStatus("OVERDUE")}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedStatus === "OVERDUE" ? 'bg-red-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        Overdue
                                    </button>
                                </div>
                            </div>
                            {selectedStatus && (
                                <button
                                    onClick={() => setSelectedStatus("")}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading Overlay */}
                {(loading || exporting) && (
                    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-4">
                            <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-700 font-medium">
                                {loading ? "Loading..." : "Exporting..."}
                            </p>
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
                                        { key: 'invoiceNumber', label: 'Invoice #' },
                                        { key: null, label: 'Vendor' },
                                        { key: 'dueDate', label: 'Due Date' },
                                        { key: 'invoiceAmount', label: 'Amount' },
                                        { key: 'amountPaid', label: 'Paid' },
                                        { key: 'balance', label: 'Balance' },
                                        { key: 'accountsPayableStatus', label: 'Status' },
                                        { key: null, label: 'Actions' },
                                    ].map((col, idx) => (
                                        <th
                                            key={idx}
                                            onClick={() => !loading && !exporting && col.key && handleSort(col.key as keyof AccountsPayable)}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? 'cursor-pointer hover:bg-gray-100' : ''
                                                } ${(loading || exporting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon column={col.key as keyof AccountsPayable} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paginated.length > 0 ? paginated.map((record) => (
                                    <tr
                                        key={record.id}
                                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${(loading || exporting) ? 'opacity-50 pointer-events-none' : ''}`}
                                        onClick={() => !loading && !exporting && navigate(`/accounts-payable/view/${record.id}`)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                                                <span className="text-sm font-medium text-gray-900">{record.invoiceNumber || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-900">{record.vendor?.name || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-sm text-gray-900">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                {new Date(record.dueDate).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">${record.invoiceAmount.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">${record.amountPaid.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-cyan-600">${record.balance.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(record.accountsPayableStatus)}`}>
                                                {getStatusIcon(record.accountsPayableStatus)}
                                                {record.accountsPayableStatus.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right relative" onClick={e => e.stopPropagation()}>
                                            <Menu as="div" className="relative inline-block text-left">
                                                <Menu.Button
                                                    disabled={loading || exporting}
                                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                                                </Menu.Button>
                                                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]">
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => navigate(`/accounts-payable/view/${record.id}`)}
                                                                disabled={loading || exporting}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                                                            >
                                                                <EyeIcon className="h-4 w-4 text-blue-600" />
                                                                View Details
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => handleMakePayment(record.id!)}
                                                                disabled={loading || exporting}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-green-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                                                            >
                                                                <BanknotesIcon className="h-4 w-4" />
                                                                Make Payment
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => navigate(`/accounts-payable/edit/${record.id}`)}
                                                                disabled={loading || exporting}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                                                            >
                                                                <PencilSquareIcon className="h-4 w-4 text-cyan-600" />
                                                                Edit
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => handleDelete(record.id!)}
                                                                disabled={loading || exporting}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed`}
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
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No payable records found</p>
                                                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
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
                                    disabled={page === 1 || loading || exporting}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages || loading || exporting}
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
                                            disabled={page === 1 || loading || exporting}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">First</span>
                                            <span>First</span>
                                        </button>
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
                                            disabled={page === 1 || loading || exporting}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <span>Previous</span>
                                        </button>

                                        {/* Page Numbers */}
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
                                                    disabled={loading || exporting}
                                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
                                                        ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                                                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    aria-current={page === pageNum ? "page" : undefined}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}

                                        <button
                                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                                            disabled={page === totalPages || loading || exporting}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Next</span>
                                            <span>Next</span>
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages || loading || exporting}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Last</span>
                                            <span>Last</span>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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

export default AccountsPayableList;
