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
import PaginatedPopup from "../../components/common/unpopup";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
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
    const [sortKey, setSortKey] = useState<keyof EmployeeDocument>("documentType");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
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

    const filtered = documents;

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

    const columns: ColumnDef<EmployeeDocument>[] = [
        {
            key: "documentType",
            label: "Document Type",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-2.5">
                    {getFileIcon(row.fileType)}
                    <span className="font-semibold text-gray-900 dark:text-white text-xs">{row.documentType}</span>
                </div>
            )
        },
        {
            key: "fileName",
            label: "File Name",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate max-w-[220px] block">{row.fileName}</span>
        },
        {
            key: "fileSize",
            label: "File Size",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-600 dark:text-gray-400">{formatFileSize(row.fileSize)}</span>
        },
        {
            key: "verified",
            label: "Status",
            sortable: true,
            render: (row) => row.verified ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-transparent dark:text-gray-300 border border-transparent">
                    <CheckCircleIcon className="h-3 w-3 mr-1 shrink-0" />
                    Verified
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-transparent dark:text-gray-400 border border-transparent">
                    <ClockIcon className="h-3 w-3 mr-1 shrink-0" />
                    Pending
                </span>
            )
        },
        {
            key: "uploadedAt",
            label: "Uploaded Date",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{row.uploadedAt ? new Date(row.uploadedAt).toLocaleDateString() : "-"}</span>
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right w-40",
            className: "text-right w-40",
            render: (row) => (
                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => { setSelectedDocument(row); setViewModalOpen(true); }}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-blue-400 p-1 rounded-md transition-colors border border-transparent dark:!border-transparent"
                        title="View Details"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => handlePreview(row)}
                        className="text-cyan-600 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-cyan-400 p-1 rounded-md transition-colors border border-transparent dark:!border-transparent"
                        title="Preview"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => handleDownload(row)}
                        className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-green-400 p-1 rounded-md transition-colors border border-transparent dark:!border-transparent"
                        title="Download"
                    >
                        <ArrowCircleDownRounded className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id, row.fileName)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-rose-400 p-1 rounded-md transition-colors border border-transparent dark:!border-transparent"
                        title="Delete"
                    >
                        <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <>
            <PageMeta title="Employee Documents" description="Manage employee documents and credentials" />
            <PageBreadcrumb pageTitle="Credential Vault" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Employee Header */}
                <div className="mb-6 bg-white dark:bg-[#191919] rounded-lg border border-gray-200 dark:!border-transparent shadow-sm p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Employee ID</p>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {!employeeId || isNaN(Number(employeeId)) ? "All Employees" : `EMP-${Number(employeeId).toString().padStart(3, '0')}`}
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsUploadOpen(true)}
                                className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold !text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg border border-transparent shadow-sm transition-all duration-200 focus:outline-none gap-2"
                            >
                                <ArrowUpIcon className="h-4 w-4 !text-white shrink-0" />
                                <span className="!text-white whitespace-nowrap">Upload Document</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <StatsCard
                        label="Total Documents"
                        value={totalDocuments}
                        gradient="from-cyan-50 to-blue-50"
                        borderColor="border-cyan-100"
                        labelColor="text-cyan-600"
                        icon={<DocumentTextIcon className="h-6 w-6" />}
                    />
                    <StatsCard
                        label="Verified"
                        value={verifiedCount}
                        gradient="from-green-50 to-emerald-50"
                        borderColor="border-green-100"
                        labelColor="text-green-600"
                        icon={<ShieldCheckIcon className="h-6 w-6" />}
                    />
                    <StatsCard
                        label="Pending Verification"
                        value={pendingCount}
                        gradient="from-amber-50 to-yellow-50"
                        borderColor="border-amber-100"
                        labelColor="text-amber-600"
                        icon={<ClockIcon className="h-6 w-6" />}
                    />
                </div>

                {/* Toolbar */}
                <div className="mb-6 flex justify-end items-center">
                    <div className="flex items-center gap-3">
                        {/* Export Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-2 rounded-lg border border-gray-300 dark:!border-transparent bg-white dark:bg-[#222222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 transition-colors"
                                disabled={documents.length === 0}
                            >
                                <DocumentArrowDownIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#191919] shadow-lg rounded-md border border-gray-200 dark:!border-transparent z-50">
                                    <button
                                        onClick={exportPDF}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#222222]"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        Export PDF
                                    </button>
                                    <button
                                        onClick={exportExcel}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#222222]"
                                    >
                                        <TableCellsIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        Export Excel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Print Button */}
                        <button
                            onClick={() => window.print()}
                            className="p-2 rounded-lg border border-gray-300 dark:!border-transparent bg-white dark:bg-[#222222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 transition-colors"
                            disabled={documents.length === 0}
                        >
                            <PrinterIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={loadDocs}
                            className="p-2 rounded-lg border border-gray-300 dark:!border-transparent bg-white dark:bg-[#222222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 transition-colors"
                        >
                            <svg className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Documents Table */}
                {!isUploadOpen && (
                    <ReusableTable
                        data={filtered}
                        columns={columns}
                        loading={loading}
                        searchable={false}
                        pageSize={10}
                        emptyState={
                            <div className="flex flex-col items-center">
                                <DocumentTextIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
                                <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">No documents found</p>
                                <p className="text-gray-400 dark:text-gray-500 text-xs">Click "Upload Document" to add one</p>
                            </div>
                        }
                    />
                )}

                {/* Upload Modal */}
                <PaginatedPopup
                    isOpen={isUploadOpen}
                    title="Upload Document"
                    onClose={() => setIsUploadOpen(false)}
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleUpload(e);
                    }}
                    submitLabel={loading ? "Uploading..." : "Upload"}
                    cancelLabel="Cancel"
                    maxWidthClassName="max-w-lg dark:!border-transparent"
                    submitting={loading}
                    fields={[
                        <div key="doc-type">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Document Type</label>
                            <select
                                value={documentType}
                                onChange={e => setDocumentType(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 dark:!border-transparent rounded-md shadow-sm p-2 bg-white dark:bg-[#222222] text-gray-900 dark:text-white focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                required
                            >
                                <option value="" className="dark:bg-[#222222] dark:text-gray-400">Select Document Type</option>
                                <option value="PAN" className="dark:bg-[#222222] dark:text-white">PAN Card</option>
                                <option value="AADHAAR" className="dark:bg-[#222222] dark:text-white">Aadhaar Card</option>
                                <option value="PASSPORT" className="dark:bg-[#222222] dark:text-white">Passport</option>
                                <option value="WORK_PERMIT" className="dark:bg-[#222222] dark:text-white">Work Permit</option>
                                <option value="EDUCATION" className="dark:bg-[#222222] dark:text-white">Education Certificate</option>
                                <option value="EXPERIENCE" className="dark:bg-[#222222] dark:text-white">Experience Letter</option>
                                <option value="PHOTO" className="dark:bg-[#222222] dark:text-white">Photograph</option>
                                <option value="SIGNATURE" className="dark:bg-[#222222] dark:text-white">Signature</option>
                                <option value="OTHER" className="dark:bg-[#222222] dark:text-white">Other</option>
                            </select>
                        </div>,
                        <div key="file-upload">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">File</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-700/60 border-dashed rounded-lg bg-gray-50/50 dark:bg-[#222222]/40">
                                <div className="space-y-1 text-center">
                                    <ArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                                    <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                                        <label className="relative cursor-pointer bg-white dark:bg-transparent rounded-md font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-cyan-500">
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
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        PDF, PNG, JPG, DOC up to 10MB
                                    </p>
                                    {file && (
                                        <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-2 font-medium">
                                            Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>,
                        <div key="note-box" className="col-span-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:!border-transparent">
                            <p className="text-sm text-blue-800 dark:text-gray-300">
                                <strong className="dark:text-white">Note:</strong> Encrypted assets take 24-48 hours for auditing. 
                                Ensure clarity in source scans for faster verification.
                            </p>
                        </div>
                    ]}
                />

                {/* View Details Modal */}
                {viewModalOpen && selectedDocument && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-black/60 backdrop-blur-xs" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white dark:bg-[#191919] rounded-lg text-left overflow-hidden shadow-xl border border-gray-100 dark:!border-transparent transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white dark:bg-[#191919] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                                    Document Details
                                                </h3>
                                                <button
                                                    onClick={() => setViewModalOpen(false)}
                                                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            <div className="mb-6 p-4 bg-gray-50 dark:bg-[#222222] rounded-lg border border-gray-100 dark:!border-transparent">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Document Type</p>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedDocument.documentType}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 border border-transparent ${selectedDocument.verified ? 'bg-green-100 text-green-800 dark:bg-transparent dark:text-gray-300' : 'bg-yellow-100 text-yellow-800 dark:bg-transparent dark:text-gray-400'}`}>
                                                            {selectedDocument.verified ? <CheckCircleIcon className="h-3 w-3 mr-1" /> : <ClockIcon className="h-3 w-3 mr-1" />}
                                                            {selectedDocument.verified ? 'Verified' : 'Pending'}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">File Name</p>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300 break-all font-mono">{selectedDocument.fileName}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">File Type</p>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300">{selectedDocument.fileType}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">File Size</p>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300">{formatFileSize(selectedDocument.fileSize)}</p>
                                                    </div>
                                                    {selectedDocument.uploadedAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">Uploaded Date</p>
                                                            <p className="text-sm text-gray-600 dark:text-gray-400">{new Date(selectedDocument.uploadedAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                    {selectedDocument.remarks && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">Remarks</p>
                                                            <p className="text-sm text-gray-700 dark:text-gray-300">{selectedDocument.remarks}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-[#191919] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100 dark:!border-transparent gap-2">
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
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:!border-transparent shadow-sm px-4 py-2 bg-white dark:bg-[#222222] text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        <ArrowCircleDownRounded className="h-4 w-4 mr-2" />
                                        Download
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:!border-transparent shadow-sm px-4 py-2 bg-white dark:bg-[#222222] text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
                            <div className="fixed inset-0 transition-opacity bg-black/60 backdrop-blur-xs" onClick={() => {
                                URL.revokeObjectURL(previewUrl);
                                setPreviewUrl(null);
                            }}></div>
                            <div className="inline-block align-bottom bg-white dark:bg-[#191919] rounded-lg text-left overflow-hidden shadow-xl border border-gray-100 dark:!border-transparent transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                                <div className="bg-white dark:bg-[#191919] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                                    Document Preview
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        URL.revokeObjectURL(previewUrl);
                                                        setPreviewUrl(null);
                                                    }}
                                                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>
                                            <div className="bg-gray-100 dark:bg-[#222222] rounded-lg p-4 min-h-[500px] flex items-center justify-center">
                                                {previewFileType.includes('image') ? (
                                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
                                                ) : previewFileType.includes('pdf') ? (
                                                    <iframe src={previewUrl} className="w-full h-[70vh]" title="PDF Preview" />
                                                ) : (
                                                    <div className="text-center">
                                                        <DocumentTextIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                                                        <p className="text-gray-500 dark:text-gray-400">Preview not available for this file type</p>
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
                                <div className="bg-gray-50 dark:bg-[#191919] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100 dark:!border-transparent gap-2">
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
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:!border-transparent shadow-sm px-4 py-2 bg-white dark:bg-[#222222] text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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