import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    FileText,
    Upload,
    Download,
    CheckCircle2,
    Clock,
    Trash2,
    X,
    Search,
    Shield,
    Plus,
    ChevronRight,
    File,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { formatFileSize } from '../../shared/utils/file';
import { usePermissions } from "../../access/usePermissions";
import { ToasterService } from '../../Services/ToasterService';
import { apiError } from '../../utils/apiError';

interface Document {
    id: number;
    employeeName?: string;
    documentType: DocumentType;
    fileName: string;
    fileType: string;
    uploadedAt?: string;
    fileSize?: number;
    status: DocumentStatus;
    // HR's reason when rejected
    remarks?: string;
}


export enum DocumentType {
    PAN = "PAN",
    AADHAAR = "AADHAAR",
    PASSPORT = "PASSPORT",
    NATIONAL_ID = "NATIONAL_ID",
    DRIVER_LICENSE = "DRIVER_LICENSE",
    WORK_PERMIT = "WORK_PERMIT",
    BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE",
    SOCIAL_SECURITY = "SOCIAL_SECURITY",
    TAX_ID = "TAX_ID"
}
type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';


const BASE_API_URL = "/v1/api/payroll/empdocuments";

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
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<'All' | DocumentType>('All');
    const [documentType, setDocumentType] = useState<DocumentType | ''>('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const formatCategoryLabel = (value: string) => {
        if (value === 'PAN') return 'PAN';
        if (value === 'AADHAAR') return 'Aadhaar';

        return value
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    };



    const shortenFileName = (
        fileName: string,
        visibleChars = 6
    ): string => {
        if (!fileName) return '';

        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return fileName.slice(0, visibleChars) + '...';
        }

        const name = fileName.slice(0, lastDotIndex);
        const ext = fileName.slice(lastDotIndex);

        if (name.length <= visibleChars) {
            return fileName;
        }

        return `${name.slice(0, visibleChars)}...${ext}`;
    };



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
        if (!uploadFile || !documentType) return;

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
                        const percent = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        setUploadProgress(percent);
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
            setDownloadProgress(0);

            const response = await axios.get(
                `${BASE_API_URL}/documents/${doc.id}/download`,
                {
                    responseType: 'blob',
                    onDownloadProgress: (progressEvent) => {
                        if (!progressEvent.total) return;

                        const percent = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        setDownloadProgress(percent);
                    },
                }
            );

            const responseContentType = response.headers['content-type'];
            const contentType =
                typeof responseContentType === 'string'
                    ? responseContentType
                    : doc.fileType || 'application/octet-stream';

            const blob = new Blob([response.data], { type: contentType as string });
            const url = window.URL.createObjectURL(blob);

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
            setDownloadProgress(0);
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

    const updateDocumentStatus = async (
        docId: number,
        action: 'approve' | 'reject'
    ) => {
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

    const filteredDocs = useMemo(() => {
        return documents.filter(doc => {
            const matchSearch =
                doc.fileName.toLowerCase().includes(search.toLowerCase()) ||
                doc.documentType.toLowerCase().includes(search.toLowerCase());

            const matchCategory =
                activeCategory === 'All' || doc.documentType === activeCategory;

            return matchSearch && matchCategory;
        });
    }, [documents, search, activeCategory]);



    const categories = [
        'All',
        ...Object.values(DocumentType),
    ] as const;

    return (
        <div className="min-h-screen bg-neutral-50 font-sans">
            <PageMeta title="Documents" description="Manage your documents" />

            {/* Header */}
            <header className="bg-white border-b border-neutral-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <PageBreadcrumb pageTitle="Documents" />
                    <div className="mt-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-semibold text-neutral-900 tracking-tight">Documents</h1>
                            <p className="mt-1 text-sm text-neutral-500">
                                {viewedEmployeeId
                                    ? `${viewedEmployeeName || documents[0]?.employeeName || `Employee ${viewedEmployeeId}`}'s documents`
                                    : 'Manage and organize your files'}
                            </p>
                        </div>
                        <button
                            disabled={!!notLinked}
                            onClick={() => setIsUploadModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
                        >
                            <Plus size={18} />
                            Upload
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Documents"
                        value={documents.length.toString()}
                        icon={<FileText size={18} />}
                    />
                    <StatCard
                        label="Approved"
                        value={documents.filter(d => d.status === 'APPROVED').length.toString()}
                        icon={<CheckCircle2 size={18} />}
                        highlight
                        bg="bg-green-50"
                    />
                    <StatCard
                        label="Pending"
                        value={documents.filter(d => d.status === 'PENDING').length.toString()}
                        icon={<Clock size={18} />}
                    />

                    <StatCard
                        label="Storage Used"
                        value={formatFileSize(documents.reduce((sum, d) => sum + (d.fileSize || 0), 0))}
                        icon={<Shield size={18} />}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Sidebar */}
                    <aside className={isSidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'}>
                        <div className="bg-white rounded-xl border border-neutral-200 p-4 h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3 px-2">
                                {!isSidebarCollapsed && (
                                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                        Categories
                                    </h3>
                                )}

                                <button
                                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                    className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"
                                    title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
                                >
                                    <ChevronRight
                                        size={16}
                                        className={`transition-transform ${isSidebarCollapsed ? '' : 'rotate-180'}`}
                                    />
                                </button>
                            </div>

                            {/* Categories */}
                            <div className="space-y-1">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat
                                            ? 'bg-neutral-900 text-white'
                                            : 'text-neutral-600 hover:bg-neutral-50'
                                            }`}
                                    >
                                        <span className={isSidebarCollapsed ? 'hidden' : ''}>
                                            {formatCategoryLabel(cat)}
                                        </span>

                                        <span className="text-xs text-neutral-400">
                                            {cat === 'All'
                                                ? documents.length
                                                : documents.filter(d => d.documentType === cat).length}
                                        </span>
                                    </button>
                                ))}
                            </div>

                        </div>
                    </aside>


                    {/* Document List */}
                    <section className={isSidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-9'}>
                        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                            {/* Search Bar */}
                            <div className="p-4 border-b border-neutral-200">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search documents..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-neutral-200">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                                Size
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 cursor-pointer">
                                        <AnimatePresence>
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-400">
                                                        Loading documents...
                                                    </td>
                                                </tr>
                                            ) : notLinked ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                                                        {notLinked}
                                                    </td>
                                                </tr>
                                            ) : filteredDocs.length > 0 ? (
                                                filteredDocs.map((doc, idx) => (
                                                    <motion.tr
                                                        key={doc.id}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: idx * 0.03 }}
                                                        className="hover:bg-neutral-50 transition-colors group"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
                                                                    <File size={18} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-sm font-medium text-neutral-900 truncate">
                                                                        {shortenFileName(doc.fileName)}
                                                                    </div>
                                                                    <div className="text-xs text-neutral-500 mt-0.5">
                                                                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-neutral-100 text-neutral-700">
                                                                {doc.documentType}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-neutral-500" title={`${doc.fileSize} bytes`}>
                                                            {formatFileSize(Number(doc.fileSize))}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <select
                                                                disabled={doc.status === 'APPROVED' || !canApprove}
                                                                value={doc.status}
                                                                onChange={(e) => {
                                                                    const value = e.target.value as DocumentStatus;

                                                                    if (value === doc.status) return;

                                                                    if (value === 'REJECTED') {
                                                                        if (!window.confirm('Reject this document?')) return;
                                                                        updateDocumentStatus(doc.id, 'reject');
                                                                    }

                                                                    if (value === 'APPROVED') {
                                                                        updateDocumentStatus(doc.id, 'approve');
                                                                    }
                                                                }}
                                                                className={`py-0 text-xs font-medium rounded-full border focus:outline-none cursor-pointer disabled:opacity-60 ${doc.status === 'APPROVED'
                                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                                    : doc.status === 'REJECTED'
                                                                        ? 'bg-red-50 text-red-700 border-red-200'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    }`}
                                                            >

                                                                <option value="PENDING" disabled>Pending</option>
                                                                <option value="APPROVED">Approved</option>
                                                                <option value="REJECTED">Rejected</option>
                                                            </select>
                                                            {doc.status === 'REJECTED' && doc.remarks && (
                                                                <div className="mt-1 text-xs text-red-600 max-w-[200px] truncate" title={doc.remarks}>
                                                                    {doc.remarks}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">

                                                                {downloadingId === doc.id ? (
                                                                    <div className="flex items-center gap-2 min-w-[120px]">
                                                                        <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-neutral-900 transition-all"
                                                                                style={{ width: `${downloadProgress}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs text-neutral-500">
                                                                            {downloadProgress}%
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <button title="Download"
                                                                        onClick={() => handleDownload(doc)}
                                                                        className="p-1.5 text-neutral-400 hover:text-blue-600 transition-colors"
                                                                    >
                                                                        <Download size={18} />
                                                                    </button>
                                                                )}
                                                                {canRemove(doc) && (
                                                                    <button title="Delete"
                                                                        onClick={() => handleDelete(doc)}
                                                                        className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-400">
                                                        No documents found
                                                    </td>
                                                </tr>
                                            )}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {isUploadModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
                        onClick={closeUpload}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <form onSubmit={handleUpload}>
                                {/* Header */}
                                <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                                    <h3 className="text-lg font-semibold text-neutral-900">Upload Document</h3>
                                    <button
                                        type="button"
                                        onClick={closeUpload}
                                        className="p-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="p-6 space-y-5">
                                    {/* Document Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                                            Document Type
                                        </label>
                                        <select disabled={isUploading}
                                            className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                                            value={documentType}
                                            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                                            required
                                        >
                                            <option value="">Select type...</option>

                                            {Object.values(DocumentType).map((type) => (
                                                <option key={type} value={type}>
                                                    {type.replace('_', ' ')}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* File Upload */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                                            File
                                        </label>
                                        <div className="relative">
                                            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${uploadFile
                                                ? 'border-neutral-900 bg-neutral-50'
                                                : 'border-neutral-200 hover:border-neutral-300'
                                                }`}>
                                                <Upload className={`mx-auto mb-3 ${uploadFile ? 'text-neutral-900' : 'text-neutral-400'}`} size={32} />
                                                <p className="text-sm font-medium text-neutral-900 mb-1">
                                                    {uploadFile ? uploadFile.name : 'Choose a file'}
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {uploadFile ? `${(uploadFile.size / 1024).toFixed(1)} KB` : 'or drag and drop'}
                                                </p>
                                            </div>
                                            <input disabled={isUploading}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                required
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                            />
                                        </div>
                                    </div>
                                    {isUploading && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-neutral-600">
                                                <span>Uploading...</span>
                                                <span>{uploadProgress}%</span>
                                            </div>

                                            <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-neutral-900 transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}


                                    {/* Info */}
                                    <div className="flex gap-3 p-4 bg-neutral-50 rounded-lg">
                                        <Shield size={18} className="text-neutral-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-neutral-600 leading-relaxed">
                                            PDF, JPG or PNG up to 5 MB. HR reviews each document before it is verified.
                                        </p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex gap-3 p-6 border-t border-neutral-200">
                                    <button
                                        type="button"
                                        onClick={closeUpload}
                                        className="flex-1 px-4 py-2.5 border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUploading || !uploadFile}
                                        className="flex-1 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isUploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const StatCard: React.FC<{
    label: string;
    value: string;
    icon: React.ReactNode;
    highlight?: boolean;
    bg?: string;
}> = ({ label, value, icon, highlight, bg }) => (
    <div className={`p-4 rounded-xl border transition-colors ${highlight
        ? 'bg-neutral-900 border-neutral-900 ' + bg
        : 'bg-white border-neutral-200 ' + bg
        }`}>
        <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${highlight ? 'bg-white/10' : 'bg-neutral-100'
                }`}>
                <div className={highlight ? 'text-white' : 'text-neutral-600'}>
                    {icon}
                </div>
            </div>
        </div>
        <div className={`text-2xl font-semibold mb-1 ${highlight ? 'text-white' : 'text-neutral-900'
            }`}>
            {value}
        </div>
        <div className={`text-xs font-medium ${highlight ? 'text-neutral-400' : 'text-neutral-500'
            }`}>
            {label}
        </div>
    </div>
);

export default DocumentManagementPage;
