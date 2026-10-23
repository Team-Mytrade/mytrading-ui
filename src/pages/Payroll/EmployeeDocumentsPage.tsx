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
    InformationCircleIcon,
    ArrowDownTrayIcon,
    PhotoIcon,
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
import { ArrowCircleDownRounded } from "@mui/icons-material";
import { todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import { AddButton } from "../../components/common/AddButton";
import { PAGE_BODY, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, STATS_ROW, TOOL_BUTTON } from "./hrmsUi";

interface EmployeeDocument {
    id: number;
    employeeId?: number;
    employeeCode?: string;
    employeeName?: string;
    documentType: string;
    fileName: string;
    fileType: string;
    fileSize?: number;
    // PENDING until HR decides
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    verified: boolean;
    uploadedAt?: string;
    // HR's reason when rejected
    remarks?: string;
}

const API_URL = "/v1/api/payroll/empdocuments";

// The document types the payroll service accepts
const DOCUMENT_TYPES: { value: string; label: string }[] = [
    { value: "PAN", label: "PAN Card" },
    { value: "AADHAAR", label: "Aadhaar Card" },
    { value: "PASSPORT", label: "Passport" },
    { value: "NATIONAL_ID", label: "National ID" },
    { value: "DRIVER_LICENSE", label: "Driving Licence" },
    { value: "WORK_PERMIT", label: "Work Permit" },
    { value: "BIRTH_CERTIFICATE", label: "Birth Certificate" },
    { value: "SOCIAL_SECURITY", label: "Social Security" },
    { value: "TAX_ID", label: "Tax ID" },
];

const STATUS_LABEL = { PENDING: "Pending", APPROVED: "Verified", REJECTED: "Rejected" } as const;

const EmployeeDocumentsPage: React.FC = () => {
  const { canDelete, canExport, canApprove } = usePermissions();
    // One employee's documents (/employees/:employeeId/documents), or everyone's
    const { employeeId } = useParams<{ employeeId: string }>();
    const employeeIdNum = Number(employeeId) || 0;

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
            const response = await axios.get(employeeIdNum ? `${API_URL}/employee/${employeeIdNum}` : `${API_URL}/getAllEmployeeDocs`);
            setDocuments(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            ToasterService.error(apiError(err, "Failed to load documents"));
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeIdNum]);

    // HR's decision; a rejection carries a reason for the employee
    const decide = async (doc: EmployeeDocument, action: "approve" | "reject") => {
        let comment: string | null = null;
        if (action === "reject") {
            comment = window.prompt(`Why is "${doc.fileName}" rejected? The employee sees this note.`);
            if (!comment?.trim()) return;
        }
        try {
            const response = await axios.post(`${API_URL}/${doc.id}/${action}`, null,
                comment ? { params: { comment: comment.trim() } } : undefined);
            setDocuments(prev => prev.map(d => (d.id === doc.id ? { ...d, ...response.data } : d)));
            ToasterService.success(action === "approve" ? "Document verified" : "Document rejected");
        } catch (err) {
            ToasterService.error(apiError(err, "The document was not updated"));
        }
    };

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
            ToasterService.error(apiError(err, "Upload failed"));
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
            await axios.delete(`${API_URL}/${id}/delete`);
            ToasterService.success("Document deleted successfully");
            await loadDocs();
        } catch (err: any) {
            ToasterService.error(apiError(err, "Delete failed"));
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
            head: [["Employee", "Document Type", "File Name", "Status", "Uploaded Date"]],
            body: filtered.map(d => [
                d.employeeName || "-",
                d.documentType,
                d.fileName,
                STATUS_LABEL[d.status] || d.status,
                d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "-"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Employee_Documents_${employeeIdNum}_${todayIso()}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(d => ({
            'Employee': d.employeeName || "",
            'Employee Code': d.employeeCode || "",
            'Document Type': d.documentType,
            'File Name': d.fileName,
            'File Type': d.fileType,
            'File Size': d.fileSize ? `${(d.fileSize / 1024).toFixed(2)} KB` : "-",
            'Status': STATUS_LABEL[d.status] || d.status,
            'Uploaded Date': d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "-",
            'Remarks': d.remarks || "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Documents");
        XLSX.writeFile(wb, `Employee_Documents_${employeeIdNum}_${todayIso()}.xlsx`);
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
    const verifiedCount = documents.filter(d => d.status === "APPROVED").length;
    const pendingCount = documents.filter(d => d.status === "PENDING").length;
    const totalDocuments = documents.length;



    // File icon in the standard cyan tile (as on the other modules' tables)
    const getFileIcon = (fileType: string) => {
        const type = fileType || "";
        const Icon = type.includes('pdf') ? DocumentTextIcon
            : type.includes('image') ? PhotoIcon
            : type.includes('zip') || type.includes('archive') ? ArchiveBoxIcon
            : FolderIcon;
        return (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40">
                <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
        );
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return "-";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const employeeColumn: ColumnDef<EmployeeDocument>[] = employeeIdNum ? [] : [{
        key: "employeeName",
        label: "Employee",
        sortable: true,
        render: (row) => (
            <div className="flex flex-col">
                <span className="font-semibold text-gray-900 dark:text-white text-xs">{row.employeeName || `Employee ${row.employeeId}`}</span>
                {row.employeeCode && <span className="text-[10px] text-gray-500 dark:text-gray-400">{row.employeeCode}</span>}
            </div>
        )
    }];

    const columns: ColumnDef<EmployeeDocument>[] = [
        ...employeeColumn,
        {
            key: "documentType",
            label: "Document Type",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    {getFileIcon(row.fileType)}
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{row.documentType}</span>
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
            key: "status",
            label: "Status",
            sortable: true,
            render: (row) => row.status === "APPROVED" ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-transparent dark:text-gray-300 border border-transparent">
                    <CheckCircleIcon className="h-3 w-3 mr-1 shrink-0" />
                    Verified
                </span>
            ) : row.status === "REJECTED" ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-transparent dark:text-rose-400 border border-transparent"
                    title={row.remarks}>
                    <XCircleIcon className="h-3 w-3 mr-1 shrink-0" />
                    Rejected
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
            headerClassName: "text-right w-48",
            className: "text-right w-48",
            render: (row) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {canApprove && row.status !== "APPROVED" && (
                        <button type="button" onClick={() => decide(row, "approve")} className={ROW_ICON_BUTTON} title="Verify">
                            <CheckCircleIcon className="h-4 w-4" />
                        </button>
                    )}
                    {canApprove && row.status === "PENDING" && (
                        <button type="button" onClick={() => decide(row, "reject")} className={ROW_ICON_BUTTON_DANGER} title="Reject">
                            <XCircleIcon className="h-4 w-4" />
                        </button>
                    )}
                    <button type="button" onClick={() => { setSelectedDocument(row); setViewModalOpen(true); }} className={ROW_ICON_BUTTON} title="Details">
                        <InformationCircleIcon className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handlePreview(row)} className={ROW_ICON_BUTTON} title="Preview">
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDownload(row)} className={ROW_ICON_BUTTON} title="Download">
                        <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                    {canDelete && (
                        <button type="button" onClick={() => handleDelete(row.id, row.fileName)} className={ROW_ICON_BUTTON_DANGER} title="Delete">
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )
        }
    ];

    return (
        <>
            <PageMeta title="Employee Documents" description="Manage employee documents and credentials" />
            <PageBreadcrumb
                pageTitle={employeeIdNum && documents[0]?.employeeName ? `${documents[0].employeeName}'s Documents` : "Documents"}
                actions={
                    <div className="flex items-center gap-2">
                        {canExport && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className={TOOL_BUTTON}
                                    disabled={documents.length === 0}
                                >
                                    <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                                    Export
                                </button>
                                {showExportMenu && (
                                    <div className="absolute right-0 top-9 w-48 bg-white dark:bg-[#191919] shadow-lg rounded-md border border-gray-200 dark:!border-transparent z-50 py-1">
                                        <button
                                            type="button"
                                            onClick={exportPDF}
                                            className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#222222]"
                                        >
                                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                                            Export PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={exportExcel}
                                            className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#222222]"
                                        >
                                            <TableCellsIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            Export Excel
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className={TOOL_BUTTON}
                            disabled={documents.length === 0}
                        >
                            <PrinterIcon className="h-3.5 w-3.5" />
                            Print
                        </button>
                        {/* Uploads go to one employee: open them from the employee's page */}
                        {employeeIdNum > 0 && <AddButton label="Upload Document" onClick={() => setIsUploadOpen(true)} />}
                    </div>
                }
            />

            <div className={PAGE_BODY}>
                <div className={STATS_ROW}>
                    <StatsCard label="Total Documents" value={totalDocuments} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-5 w-5" />} />
                    <StatsCard label="Verified" value={verifiedCount} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<ShieldCheckIcon className="h-5 w-5" />} />
                    <StatsCard label="Pending Verification" value={pendingCount} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ClockIcon className="h-5 w-5" />} />
                    <StatsCard label="Rejected" value={documents.filter(d => d.status === "REJECTED").length} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" icon={<XCircleIcon className="h-5 w-5" />} onRefresh={loadDocs} />
                </div>

                {/* Documents Table */}
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
                            <p className="text-gray-400 dark:text-gray-500 text-xs">
                                {employeeIdNum ? 'Click "Upload Document" to add one' : "Employees upload theirs from their Documents page"}
                            </p>
                        </div>
                    }
                />

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
                                {DOCUMENT_TYPES.map(type => (
                                    <option key={type.value} value={type.value} className="dark:bg-[#222222] dark:text-white">{type.label}</option>
                                ))}
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
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                className="sr-only"
                                                onChange={e => setFile(e.target.files?.[0] || null)}
                                                required
                                            />
                                        </label>
                                        <p className="pl-1">or drag and drop</p>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        PDF, JPG or PNG up to 5 MB
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
                                <strong className="dark:text-white">Note:</strong> HR verifies each document.
                                Clear scans are verified faster.
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