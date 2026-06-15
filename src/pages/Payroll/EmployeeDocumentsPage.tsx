import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
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
    UserGroupIcon,
    DocumentTextIcon,
    PrinterIcon,
    ShieldCheckIcon,
    ClockIcon,
    ArrowLongUpIcon,
    ChevronDoubleDownIcon,
    FolderIcon,
    ArchiveBoxIcon,
    QrCodeIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { ArrowCircleDownRounded, Image } from "@mui/icons-material";

interface EmployeeDocument {
    id: number;
    documentType: string;
    fileName: string;
    fileType: string;
    fileSize?: number;
    verified: boolean;
    uploadedAt?: string;
    remarks?: string;
}

const API_URL = "/v1/api/payroll/empdocuments";

const EmployeeDocumentsPage: React.FC = () => {
    const { employeeId } = useParams<{ employeeId: string }>();
    const employeeIdNum = Number(employeeId);

    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [documentType, setDocumentType] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFileType, setPreviewFileType] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof EmployeeDocument>("documentType");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [verifiedFilter, setVerifiedFilter] = useState<"All" | "Verified" | "Pending">("All");
    const [typeFilter, setTypeFilter] = useState<string>("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<EmployeeDocument | null>(null);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const PAGE_SIZE = 9; // 3x3 grid

    const loadDocs = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/employee/${employeeIdNum}`);
            setDocuments(response.data);
        } catch (err) {
            console.error("Failed to load documents", err);
            ToasterService.error("Failed to load documents");
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (employeeIdNum) loadDocs();
    }, [employeeIdNum]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !documentType) {
            ToasterService.warning("Please select a document type and file");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("documentType", documentType);
            await axios.post(`${API_URL}/upload/${employeeIdNum}`, formData);
            ToasterService.success("Document uploaded successfully");
            await loadDocs();
            setIsUploadOpen(false);
            setFile(null);
            setDocumentType("");
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Upload failed");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, fileName: string) => {
        const ok = await confirm({
            message: `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;

        try {
            await axios.delete(`${API_URL}/documents/${id}`);
            ToasterService.success("Document deleted successfully");
            await loadDocs();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const fetchBlob = async (docId: number): Promise<Blob> => {
        const response = await axios.get(`${API_URL}/documents/${docId}/download`, {
            responseType: "blob"
        });
        return response.data;
    };

    const handlePreview = async (doc: EmployeeDocument) => {
        try {
            const blob = await fetchBlob(doc.id);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            setPreviewFileType(doc.fileType);
        } catch (err) {
            ToasterService.error("Failed to preview document");
        }
    };

    const handleDownload = async (doc: EmployeeDocument) => {
        try {
            const blob = await fetchBlob(doc.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = doc.fileName;
            link.click();
            URL.revokeObjectURL(url);
            ToasterService.success("Download started");
        } catch (err) {
            ToasterService.error("Failed to download document");
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Employee Documents - ID: ${employeeIdNum}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Documents: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Document Type", "File Name", "Status", "Uploaded Date"]],
            body: filtered.map(d => [
                d.documentType,
                d.fileName,
                d.verified ? "Verified" : "Pending",
                d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "-"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Employee_Documents_${employeeIdNum}_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(d => ({
            'Document Type': d.documentType,
            'File Name': d.fileName,
            'File Type': d.fileType,
            'File Size': d.fileSize ? `${(d.fileSize / 1024).toFixed(2)} KB` : "-",
            'Status': d.verified ? "Verified" : "Pending",
            'Uploaded Date': d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "-",
            'Remarks': d.remarks || "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Documents");
        XLSX.writeFile(wb, `Employee_Documents_${employeeIdNum}_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const handleSort = (field: keyof EmployeeDocument) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const filtered = documents.filter(doc => {
        const matchesSearch = doc.documentType.toLowerCase().includes(search.toLowerCase()) ||
            doc.fileName.toLowerCase().includes(search.toLowerCase());
        const matchesVerified = verifiedFilter === "All" || 
            (verifiedFilter === "Verified" ? doc.verified : !doc.verified);
        const matchesType = typeFilter ? doc.documentType === typeFilter : true;
        return matchesSearch && matchesVerified && matchesType;
    });

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (typeof valA === "boolean" && typeof valB === "boolean") {
            return sortOrder === "asc" ? (valA === valB ? 0 : valA ? 1 : -1) : (valA === valB ? 0 : valA ? -1 : 1);
        }

        return 0;
    });

    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

    // Calculate stats from real data
    const verifiedCount = documents.filter(d => d.verified).length;
    const pendingCount = documents.filter(d => !d.verified).length;
    const totalDocuments = documents.length;

    // Get unique document types for filter
    const uniqueTypes = [...new Set(documents.map(d => d.documentType))];

    // File icon component
    const getFileIcon = (fileType: string) => {
        if (fileType.includes('pdf')) {
            return <DocumentTextIcon className="h-8 w-8 text-red-500" />;
        }
        if (fileType.includes('image')) {
            return <Image className="h-8 w-8 text-green-500" />;
        }
        if (fileType.includes('zip') || fileType.includes('archive')) {
            return <ArchiveBoxIcon className="h-8 w-8 text-amber-500" />;
        }
        return <FolderIcon className="h-8 w-8 text-blue-500" />;
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return "-";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <>
            <PageMeta title="Employee Documents" description="Manage employee documents and credentials" />
            <PageBreadcrumb pageTitle="Credential Vault" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Employee Header */}
                <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Employee ID</p>
                            <h2 className="text-2xl font-bold text-gray-900">EMP-{employeeIdNum.toString().padStart(3, '0')}</h2>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsUploadOpen(true)}
                                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
                            >
                                <ArrowUpIcon className="h-5 w-5" />
                                Upload Document
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Documents</p>
                                <p className="text-2xl font-semibold text-gray-900">{totalDocuments}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Verified</p>
                                <p className="text-2xl font-semibold text-green-600">{verifiedCount}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <ShieldCheckIcon className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending Verification</p>
                                <p className="text-2xl font-semibold text-yellow-600">{pendingCount}</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-full">
                                <ClockIcon className="h-6 w-6 text-yellow-600" />
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
                                placeholder="Search by document type or file name..."
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
                                disabled={documents.length === 0}
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
                            disabled={documents.length === 0}
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
                            onClick={loadDocs}
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Status</label>
                                <select
                                    value={verifiedFilter}
                                    onChange={e => { setVerifiedFilter(e.target.value as any); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Verified">Verified</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                                <select
                                    value={typeFilter}
                                    onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Types</option>
                                    {uniqueTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            {(verifiedFilter !== "All" || typeFilter) && (
                                <button
                                    onClick={() => {
                                        setVerifiedFilter("All");
                                        setTypeFilter("");
                                    }}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Documents Grid */}
                {!isUploadOpen && (
                    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                                <span className="ml-3 text-gray-500">Loading documents...</span>
                            </div>
                        ) : paginated.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                                {paginated.map(doc => (
                                    <div
                                        key={doc.id}
                                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow group"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                {getFileIcon(doc.fileType)}
                                            </div>
                                            <div className="flex gap-2">
                                                <Menu as="div" className="relative inline-block text-left">
                                                    <Menu.Button className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                                                        <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
                                                    </Menu.Button>
                                                    <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedDocument(doc);
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
                                                                    onClick={() => handlePreview(doc)}
                                                                    className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                                >
                                                                    <EyeIcon className="h-4 w-4 text-cyan-600" />
                                                                    Preview
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={() => handleDownload(doc)}
                                                                    className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                                >
                                                                    <ArrowCircleDownRounded className="h-4 w-4 text-green-600" />
                                                                    Download
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={() => handleDelete(doc.id, doc.fileName)}
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
                                        </div>

                                        <div className="mb-3">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${doc.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {doc.verified ? <CheckCircleIcon className="h-3 w-3 mr-1" /> : <ClockIcon className="h-3 w-3 mr-1" />}
                                                {doc.verified ? 'Verified' : 'Pending'}
                                            </span>
                                        </div>

                                        <h4 className="text-sm font-semibold text-gray-900 mb-1">{doc.documentType}</h4>
                                        <p className="text-xs text-gray-500 truncate mb-2">{doc.fileName}</p>
                                        <p className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</p>

                                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                                            <button
                                                onClick={() => handlePreview(doc)}
                                                className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <EyeIcon className="h-3 w-3" />
                                                Preview
                                            </button>
                                            <button
                                                onClick={() => handleDownload(doc)}
                                                className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <ArrowCircleDownRounded className="h-3 w-3" />
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20">
                                <DocumentTextIcon className="h-16 w-16 text-gray-300 mb-4" />
                                <p className="text-gray-500 text-sm mb-2">No documents found</p>
                                <p className="text-gray-400 text-xs">Click "Upload Document" to add one</p>
                            </div>
                        )}

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
                )}

                {/* Upload Modal */}
                {isUploadOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsUploadOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                Upload Document
                                            </h3>
                                            <form onSubmit={handleUpload} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Document Type</label>
                                                    <select
                                                        value={documentType}
                                                        onChange={e => setDocumentType(e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    >
                                                        <option value="">Select Document Type</option>
                                                        <option value="PAN">PAN Card</option>
                                                        <option value="AADHAAR">Aadhaar Card</option>
                                                        <option value="PASSPORT">Passport</option>
                                                        <option value="WORK_PERMIT">Work Permit</option>
                                                        <option value="EDUCATION">Education Certificate</option>
                                                        <option value="EXPERIENCE">Experience Letter</option>
                                                        <option value="PHOTO">Photograph</option>
                                                        <option value="SIGNATURE">Signature</option>
                                                        <option value="OTHER">Other</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">File</label>
                                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                                                        <div className="space-y-1 text-center">
                                                            <ArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                                                            <div className="flex text-sm text-gray-600">
                                                                <label className="relative cursor-pointer bg-white rounded-md font-medium text-cyan-600 hover:text-cyan-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-cyan-500">
                                                                    <span>Upload a file</span>
                                                                    <input
                                                                        type="file"
                                                                        className="sr-only"
                                                                        onChange={e => setFile(e.target.files?.[0] || null)}
                                                                        required
                                                                    />
                                                                </label>
                                                                <p className="pl-1">or drag and drop</p>
                                                            </div>
                                                            <p className="text-xs text-gray-500">
                                                                PDF, PNG, JPG, DOC up to 10MB
                                                            </p>
                                                            {file && (
                                                                <p className="text-xs text-cyan-600 mt-2">
                                                                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>Note:</strong> Encrypted assets take 24-48 hours for auditing. 
                                                        Ensure clarity in source scans for faster verification.
                                                    </p>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        onClick={handleUpload}
                                        disabled={loading}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {loading ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                        ) : (
                                            "Upload"
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsUploadOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Details Modal */}
                {viewModalOpen && selectedDocument && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Document Details
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
                                                        <p className="text-xs text-gray-500">Document Type</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedDocument.documentType}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Status</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${selectedDocument.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                            {selectedDocument.verified ? <CheckCircleIcon className="h-3 w-3 mr-1" /> : <ClockIcon className="h-3 w-3 mr-1" />}
                                                            {selectedDocument.verified ? 'Verified' : 'Pending'}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500">File Name</p>
                                                        <p className="text-sm text-gray-700 break-all">{selectedDocument.fileName}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">File Type</p>
                                                        <p className="text-sm text-gray-700">{selectedDocument.fileType}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">File Size</p>
                                                        <p className="text-sm text-gray-700">{formatFileSize(selectedDocument.fileSize)}</p>
                                                    </div>
                                                    {selectedDocument.uploadedAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Uploaded Date</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedDocument.uploadedAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                    {selectedDocument.remarks && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Remarks</p>
                                                            <p className="text-sm text-gray-700">{selectedDocument.remarks}</p>
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
                                            handlePreview(selectedDocument);
                                        }}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        <EyeIcon className="h-4 w-4 mr-2" />
                                        Preview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewModalOpen(false);
                                            handleDownload(selectedDocument);
                                        }}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        <ArrowCircleDownRounded className="h-4 w-4 mr-2" />
                                        Download
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Preview Modal */}
                {previewUrl && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => {
                                URL.revokeObjectURL(previewUrl);
                                setPreviewUrl(null);
                            }}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Document Preview
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        URL.revokeObjectURL(previewUrl);
                                                        setPreviewUrl(null);
                                                    }}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>
                                            <div className="bg-gray-100 rounded-lg p-4 min-h-[500px] flex items-center justify-center">
                                                {previewFileType.includes('image') ? (
                                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
                                                ) : previewFileType.includes('pdf') ? (
                                                    <iframe src={previewUrl} className="w-full h-[70vh]" title="PDF Preview" />
                                                ) : (
                                                    <div className="text-center">
                                                        <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                                        <p className="text-gray-500">Preview not available for this file type</p>
                                                        <button
                                                            onClick={() => {
                                                                const link = document.createElement("a");
                                                                link.href = previewUrl;
                                                                link.download = "document";
                                                                link.click();
                                                            }}
                                                            className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                                                        >
                                                            Download to View
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const link = document.createElement("a");
                                            link.href = previewUrl;
                                            link.download = "document";
                                            link.click();
                                        }}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        <ArrowCircleDownRounded className="h-4 w-4 mr-2" />
                                        Download
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            URL.revokeObjectURL(previewUrl);
                                            setPreviewUrl(null);
                                        }}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Close
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

export default EmployeeDocumentsPage;