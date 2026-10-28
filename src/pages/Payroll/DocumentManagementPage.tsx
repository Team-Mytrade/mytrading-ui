import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowDownTrayIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentTextIcon,
    PhotoIcon,
    ShieldCheckIcon,
    TrashIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AddButton } from '../../components/common/AddButton';
import StatsCard from '../../components/common/Statscard';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import PaginatedPopup from '../../components/common/unpopup';
import { FloatingSelect1 as FloatingSelect } from '../../components/inputfeild/FloatingInput';
import { formatFileSize } from '../../shared/utils/file';
import { usePermissions } from "../../access/usePermissions";
import { ToasterService } from '../../Services/ToasterService';
import { apiError } from '../../utils/apiError';
import { PAGE_BODY, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, STATS_ROW } from './hrmsUi';
import { formatDate } from "../../company/format";

type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Document {
    id: number;
    employeeName?: string;
    documentType: string;
    fileName: string;
    fileType: string;
    uploadedAt?: string;
    fileSize?: number;
    status: DocumentStatus;
    // HR's reason when rejected
    remarks?: string;
}

// The document types the payroll service accepts
const DOCUMENT_TYPES = [
    { id: "PAN", name: "PAN Card" },
    { id: "AADHAAR", name: "Aadhaar Card" },
    { id: "PASSPORT", name: "Passport" },
    { id: "NATIONAL_ID", name: "National ID" },
    { id: "DRIVER_LICENSE", name: "Driving Licence" },
    { id: "WORK_PERMIT", name: "Work Permit" },
    { id: "BIRTH_CERTIFICATE", name: "Birth Certificate" },
    { id: "SOCIAL_SECURITY", name: "Social Security" },
    { id: "TAX_ID", name: "Tax ID" },
];
const typeName = (type: string) => DOCUMENT_TYPES.find(t => t.id === type)?.name || type;

const STATUS_STYLE: Record<DocumentStatus, string> = {
    APPROVED: "bg-green-100 text-green-800 border-green-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    PENDING: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    REJECTED: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
};
const STATUS_LABEL: Record<DocumentStatus, string> = { APPROVED: "Verified", PENDING: "Pending", REJECTED: "Rejected" };

const BASE_API_URL = "/v1/api/payroll/empdocuments";
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const DocumentManagementPage: React.FC = () => {
    // Approving or rejecting a document needs HRM:APPROVE
    const { canApprove, canDelete } = usePermissions();
    // HR opens an employee's documents with ?id= (from the employee page); everyone else sees their own
    const searchParams = new URLSearchParams(useLocation().search);
    const viewedEmployeeId = canApprove && searchParams.get('id') ? Number(searchParams.get('id')) : null;
    const viewedEmployeeName = searchParams.get('employeeName');
    const [notLinked, setNotLinked] = useState<string | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [documentType, setDocumentType] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    useEffect(() => {
        fetchDocuments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewedEmployeeId]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(viewedEmployeeId ? `${BASE_API_URL}/employee/${viewedEmployeeId}` : `${BASE_API_URL}/my`);
            setDocuments(Array.isArray(res.data) ? res.data : []);
            setNotLinked(null);
        } catch (error) {
            setDocuments([]);
            // An account without an employee record has no documents here
            if (axios.isAxiosError(error) && error.response?.status === 403 && !viewedEmployeeId) setNotLinked(apiError(error, "No employee record is linked to your account."));
            else ToasterService.error(apiError(error, "Could not load the documents"));
        } finally { setLoading(false); }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!documentType) {
            ToasterService.error("Choose the type of document");
            return;
        }
        if (!uploadFile) {
            ToasterService.error("Choose the file to upload");
            return;
        }
        if (!ALLOWED_TYPES.includes(uploadFile.type) || uploadFile.size > 5 * 1024 * 1024) {
            ToasterService.error("Upload a PDF, JPG or PNG of at most 5 MB");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const form = new FormData();
            form.append("file", uploadFile);
            form.append("documentType", documentType);

            await axios.post(
                viewedEmployeeId ? `${BASE_API_URL}/upload/${viewedEmployeeId}` : `${BASE_API_URL}/my/upload`,
                form,
                {
                    onUploadProgress: (progressEvent) => {
                        if (!progressEvent.total) return;
                        setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                    },
                }
            );

            ToasterService.success("Document uploaded", "HR will verify it.");
            fetchDocuments();
            closeUpload();
        } catch (error) {
            ToasterService.error(apiError(error, "The upload failed"));
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDownload = async (doc: Document) => {
        try {
            setDownloadingId(doc.id);
            const response = await axios.get(`${BASE_API_URL}/documents/${doc.id}/download`, { responseType: 'blob' });

            const responseContentType = response.headers['content-type'];
            const contentType = typeof responseContentType === 'string' ? responseContentType : doc.fileType || 'application/octet-stream';
            const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.fileName || `document-${doc.id}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            ToasterService.error(apiError(err, 'Failed to download the document'));
        } finally {
            setDownloadingId(null);
        }
    };

    // Employees remove their own uploads until HR approves them; HR (HRM:DELETE) removes any
    const canRemove = (doc: Document) => (viewedEmployeeId ? canDelete : doc.status !== 'APPROVED' || canDelete);

    const handleDelete = async (doc: Document) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            const ownPending = !viewedEmployeeId && doc.status !== 'APPROVED';
            await axios.delete(ownPending ? `${BASE_API_URL}/my/${doc.id}` : `${BASE_API_URL}/${doc.id}/delete`);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            ToasterService.success('Document deleted');
        } catch (error) {
            ToasterService.error(apiError(error, 'Failed to delete the document'));
        }
    };

    const updateDocumentStatus = async (docId: number, action: 'approve' | 'reject') => {
        // A rejection tells the employee why
        let comment: string | null = null;
        if (action === 'reject') {
            comment = window.prompt('Why is this document rejected? The employee sees this note.');
            if (!comment?.trim()) return;
        }
        try {
            const res = await axios.post(`${BASE_API_URL}/${docId}/${action}`, null,
                comment ? { params: { comment: comment.trim() } } : undefined);
            setDocuments((prev) => prev.map((doc) => (doc.id === docId ? { ...doc, ...res.data } : doc)));
            ToasterService.success(action === 'approve' ? 'Document approved' : 'Document rejected');
        } catch (error) {
            ToasterService.error(apiError(error, 'Failed to update the document'));
        }
    };

    const closeUpload = () => {
        setIsUploadModalOpen(false);
        setUploadFile(null);
        setDocumentType("");
    };

    const count = (status: DocumentStatus) => documents.filter(d => d.status === status).length;
    const whose = viewedEmployeeId
        ? `${viewedEmployeeName || documents[0]?.employeeName || `Employee ${viewedEmployeeId}`}'s Documents`
        : "My Documents";

    const columns: ColumnDef<Document>[] = [
        {
            key: "documentType",
            label: "Document",
            sortable: true,
            render: (doc) => {
                const Icon = doc.fileType?.includes('image') ? PhotoIcon : DocumentTextIcon;
                return (
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40">
                            <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{typeName(doc.documentType)}</p>
                            <p className="max-w-[220px] truncate text-xs text-slate-400 dark:text-slate-500" title={doc.fileName}>{doc.fileName}</p>
                        </div>
                    </div>
                );
            },
        },
        {
            key: "fileSize",
            label: "Size",
            sortable: true,
            render: (doc) => <span className="text-sm text-slate-600 dark:text-slate-300">{formatFileSize(Number(doc.fileSize || 0))}</span>,
        },
        {
            key: "uploadedAt",
            label: "Uploaded",
            sortable: true,
            render: (doc) => <span className="text-sm text-slate-600 dark:text-slate-300">{doc.uploadedAt ? formatDate(doc.uploadedAt) : "-"}</span>,
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            render: (doc) => (
                <div>
                    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[doc.status] || STATUS_STYLE.PENDING}`}>
                        {STATUS_LABEL[doc.status] || doc.status}
                    </span>
                    {doc.status === 'REJECTED' && doc.remarks && (
                        <p className="mt-1 max-w-[220px] truncate text-xs text-red-600 dark:text-red-400" title={doc.remarks}>{doc.remarks}</p>
                    )}
                </div>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right",
            className: "text-right",
            render: (doc) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {canApprove && doc.status !== 'APPROVED' && (
                        <button type="button" onClick={() => updateDocumentStatus(doc.id, 'approve')} className={ROW_ICON_BUTTON} title="Verify">
                            <CheckCircleIcon className="h-4 w-4" />
                        </button>
                    )}
                    {canApprove && doc.status === 'PENDING' && (
                        <button type="button" onClick={() => updateDocumentStatus(doc.id, 'reject')} className={ROW_ICON_BUTTON_DANGER} title="Reject">
                            <XCircleIcon className="h-4 w-4" />
                        </button>
                    )}
                    <button type="button" onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id} className={ROW_ICON_BUTTON} title="Download">
                        <ArrowDownTrayIcon className={`h-4 w-4 ${downloadingId === doc.id ? 'animate-pulse' : ''}`} />
                    </button>
                    {canRemove(doc) && (
                        <button type="button" onClick={() => handleDelete(doc)} className={ROW_ICON_BUTTON_DANGER} title="Delete">
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title="Documents" description="Manage your documents" />
            <PageBreadcrumb
                pageTitle={whose}
                actions={!notLinked && (
                    <AddButton label="Upload Document" permission={null} onClick={() => setIsUploadModalOpen(true)} />
                )}
            />

            <div className={PAGE_BODY}>
                <div className={STATS_ROW}>
                    <StatsCard label="Total Documents" value={documents.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-5 w-5" />} />
                    <StatsCard label="Verified" value={count('APPROVED')} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<ShieldCheckIcon className="h-5 w-5" />} />
                    <StatsCard label="Pending" value={count('PENDING')} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ClockIcon className="h-5 w-5" />} />
                    <StatsCard label="Rejected" value={count('REJECTED')} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" icon={<XCircleIcon className="h-5 w-5" />} onRefresh={fetchDocuments} />
                </div>

                <ReusableTable
                    data={documents}
                    columns={columns}
                    loading={loading}
                    pageSize={10}
                    defaultSortKey="uploadedAt"
                    defaultSortOrder="desc"
                    emptyState={
                        <div className="flex flex-col items-center justify-center py-12">
                            <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                            <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
                                {notLinked || "No documents yet"}
                            </p>
                            {!notLinked && (
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(true)}
                                    className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                                >
                                    Upload your first document
                                </button>
                            )}
                        </div>
                    }
                />
            </div>

            <PaginatedPopup
                isOpen={isUploadModalOpen}
                title="Upload Document"
                subtitle="PDF, JPG or PNG up to 5 MB. HR reviews each document before it is verified."
                onClose={closeUpload}
                onSubmit={handleUpload}
                submitting={isUploading}
                submitLabel={isUploading ? `Uploading ${uploadProgress}%` : "Upload"}
                maxWidthClassName="max-w-lg"
                tabs={[
                    {
                        label: "Document",
                        fields: [
                            <div key="type" className="md:col-span-2">
                                <FloatingSelect
                                    label="Document Type"
                                    name="documentType"
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                    options={DOCUMENT_TYPES}
                                    required
                                    disabled={isUploading}
                                />
                            </div>,
                            <label
                                key="file"
                                className="md:col-span-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition hover:border-cyan-400 dark:border-gray-700 dark:bg-[#222222]"
                            >
                                <ArrowDownTrayIcon className="mb-2 h-6 w-6 rotate-180 text-cyan-600 dark:text-cyan-400" />
                                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
                                    {uploadFile ? uploadFile.name : "Choose a file"}
                                </span>
                                <span className="mt-0.5 text-xs text-slate-400">
                                    {uploadFile ? formatFileSize(uploadFile.size) : "PDF, JPG or PNG"}
                                </span>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="sr-only"
                                    disabled={isUploading}
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                />
                            </label>,
                        ],
                    },
                ]}
            />
        </>
    );
};

export default DocumentManagementPage;
