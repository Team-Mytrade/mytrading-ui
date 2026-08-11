import React, { useContext, useEffect, useState, useMemo } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import {
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    CheckCircleIcon,
    XCircleIcon,
    TableCellsIcon,
    EyeIcon,
    CubeIcon,
    ClipboardDocumentCheckIcon,
    UserIcon,
    CalendarIcon,
    PrinterIcon,
    DocumentTextIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { ToasterService } from "../../Services/ToasterService";
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
import DynamicPopup from "../../components/common/Popup";
import PaginatedPopup from "../../components/common/unpopup";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import {
    FloatingInput,
    FloatingSelect1 as FloatingSelect,
    FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { AuthContext } from "../../context/AuthContext";

interface Product {
    id: number;
    productName: string;
    sku?: string;
    code?: string;
}

// ---------- Nested reference types, matching the actual backend schema ----------
interface WarehouseRef {
    id: number;
    code?: string;
    name: string;
    locationType?: string;
}

interface BatchRef {
    id: number;
    batchNumber: string;
    manufacturingDate?: string;
    expiryDate?: string;
    productId?: number;
    warehouse?: WarehouseRef;
}

interface SerialNumberRef {
    id: number;
    serial: string;
    warrantyStart?: string;
    warrantyEnd?: string;
    productId?: number;
    productNumber?: string;
    warehouse?: WarehouseRef;
    batch?: BatchRef;
}


// ---------- Enums ----------
// TODO(backend): these are hardcoded until the backend exposes a validation-enum
// endpoint (e.g. GET /v1/api/inventory/quality-inspections/enums). When that's
// ready, replace RESULT_OPTIONS / INSPECTION_TYPE_OPTIONS below with data fetched
// from that endpoint instead of editing this list by hand. Keeping the values
// centralized here (rather than scattered as inline strings) means that swap is
// a one-place change.
type ResultCode = "PASS" | "FAIL" | "HOLD" | "REJECT";
type InspectionTypeCode = "INCOMING" | "RETURN" | "RANDOM" | "AUDIT";

const RESULT_OPTIONS: { id: ResultCode; name: string }[] = [
    { id: "PASS", name: "Pass" },
    { id: "FAIL", name: "Fail" },
    { id: "HOLD", name: "Hold" },
    { id: "REJECT", name: "Reject" },
];

const INSPECTION_TYPE_OPTIONS: { id: InspectionTypeCode; name: string }[] = [
    { id: "INCOMING", name: "Incoming" },
    { id: "RETURN", name: "Return" },
    { id: "RANDOM", name: "Random" },
    { id: "AUDIT", name: "Audit" },
];

const getResultLabel = (result: string) =>
    RESULT_OPTIONS.find((r) => r.id === result)?.name || result;

const getInspectionTypeLabel = (type?: string) =>
    INSPECTION_TYPE_OPTIONS.find((t) => t.id === type)?.name || type || "N/A";

interface QualityInspection {
    id: number;
    productName?: string;   
    productId?: number;
    inspectionDate: string;
    inspectorName: string; 
    inspector?: string;
    result: ResultCode;
    inspectionType?: InspectionTypeCode;
    remarks?: string;
    batch?: BatchRef;
    serialNumber?: SerialNumberRef;
    createdAt?: string;
    updatedAt?: string;
    createdDate?: string;
    updatedDate?: string;
}

const API_BASE = "/v1/api/inventory";
const API_URL = `${API_BASE}/quality-inspections`;
const BATCHES_URL = `${API_BASE}/batches`;
const SERIAL_NUMBERS_URL = `${API_BASE}/serial-numbers`;
const PRODUCTS_API_URL = "/v1/api/purchase/products";
const qualityInspectionApi = axios.create();

qualityInspectionApi.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const PAGE_SIZE = 10;


const PRODUCT_ROUTE = "/purchase-products"; // <Route path="/purchase-products" element={<Products />} />
const BATCH_ROUTE = "/batch";               // <Route path="/batch" element={<Batch />} />
const SERIAL_NUMBER_ROUTE = "/serial-number"; // <Route path="/serial-number" element={<SerialNumber />} />

type FormState = {
    productId: number;
    inspectionDate: string;
    inspectorName: string;
    inspector: string;
    result: ResultCode;
    inspectionType: InspectionTypeCode | "";
    remarks: string;
    batchId: string;
    serialNumberId: string;
};

const emptyFormState: FormState = {
    productId: 0,
    inspectionDate: new Date().toISOString().split("T")[0],
    inspectorName: "",
    inspector: "",
    result: "PASS",
    inspectionType: "",
    remarks: "",
    batchId: "",
    serialNumberId: "",
};

const QualityInspectionManager: React.FC = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [records, setRecords] = useState<QualityInspection[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [resultFilter, setResultFilter] = useState<"All" | ResultCode>("All");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<QualityInspection | null>(null);
    const [deletingRecord, setDeletingRecord] = useState<QualityInspection | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [products, setProducts] = useState<Product[]>([]);
    const [batches, setBatches] = useState<BatchRef[]>([]);
    const [serialNumbers, setSerialNumbers] = useState<SerialNumberRef[]>([]);

    const [formData, setFormData] = useState<FormState>(emptyFormState);

    useEffect(() => {
        fetchRecords();
        fetchProducts();
        fetchBatches();
        fetchSerialNumbers();
    }, []);

   
    const getProductDisplayName = (record: QualityInspection) => {
        const product = products.find((p) => p.id === record.productId);
        if (product) return product.productName || product.sku || product.code || `Product #${product.id}`;
        if (record.productName) return record.productName;
        return record.productId ? `Product #${record.productId}` : "N/A";
    };

    const getProductSku = (record: QualityInspection) => {
        const product = products.find((p) => p.id === record.productId);
        return product?.sku || product?.code || "";
    };

    const getBatchDisplay = (batch?: BatchRef) => batch?.batchNumber || "N/A";
    const getSerialDisplay = (serialNumber?: SerialNumberRef) => serialNumber?.serial || "N/A";

    const goToProduct = (productId?: number) => {
        if (!productId) return;
        navigate(`${PRODUCT_ROUTE}?productId=${productId}`, { state: { productId } });
    };

    const goToBatch = (batch?: BatchRef) => {
        if (!batch?.id) return;
        navigate(`${BATCH_ROUTE}?batchId=${batch.id}`, {
            state: { batchId: batch.id, batchNumber: batch.batchNumber },
        });
    };

    const goToSerialNumber = (serialNumber?: SerialNumberRef) => {
        if (!serialNumber?.id) return;
        navigate(`${SERIAL_NUMBER_ROUTE}?serialNumberId=${serialNumber.id}`, {
            state: { serialNumberId: serialNumber.id, serial: serialNumber.serial },
        });
    };

    const normalizeInspection = (record: any): QualityInspection => {
        const rawResult = String(record?.result || "PASS").toUpperCase();
        const result: ResultCode = RESULT_OPTIONS.some((r) => r.id === rawResult)
            ? (rawResult as ResultCode)
            : "PASS";

        const rawType = record?.inspectionType ? String(record.inspectionType).toUpperCase() : undefined;
        const inspectionType: InspectionTypeCode | undefined = INSPECTION_TYPE_OPTIONS.some((t) => t.id === rawType)
            ? (rawType as InspectionTypeCode)
            : undefined;

        return {
            ...record,
            id: record?.id ?? 0,
            productName: record?.productName || record?.product?.name || "",
            productId: record?.productId,
            inspectionDate: record?.inspectionDate || new Date().toISOString().split("T")[0],
            inspectorName: record?.inspectorName || record?.inspector || "",
            inspector: record?.inspector || record?.inspectorName || "",
            result,
            inspectionType,
            remarks: record?.remarks || "",
            batch: record?.batch || undefined,
            serialNumber: record?.serialNumber || undefined,
            createdAt: record?.createdAt || record?.createdDate,
            updatedAt: record?.updatedAt || record?.updatedDate,
            createdDate: record?.createdDate,
            updatedDate: record?.updatedDate,
        };
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const response = await qualityInspectionApi.get(API_URL);
            const rows = Array.isArray(response.data) ? response.data : response.data?.content || response.data?.data || [];
            setRecords(rows.map(normalizeInspection));
        } catch (err) {
            console.error("Failed to load quality inspections", err);
            ToasterService.error("Failed to load inspection records");
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await qualityInspectionApi.get(PRODUCTS_API_URL);
            const rows = Array.isArray(res.data) ? res.data : res.data?.content || res.data?.data || [];
            setProducts(rows);
        } catch (err) {
            console.error("Failed to load products", err);
            ToasterService.error("Failed to load products");
            setProducts([]);
        }
    };

    const fetchBatches = async () => {
        try {
            const res = await qualityInspectionApi.get(BATCHES_URL);
            const rows = Array.isArray(res.data) ? res.data : res.data?.content || res.data?.data || [];
            setBatches(rows);
        } catch (err) {
            console.error("Failed to load batches", err);
            ToasterService.error("Failed to load batches");
            setBatches([]);
        }
    };

    const fetchSerialNumbers = async () => {
        try {
            const res = await qualityInspectionApi.get(SERIAL_NUMBERS_URL);
            const rows = Array.isArray(res.data) ? res.data : res.data?.content || res.data?.data || [];
            setSerialNumbers(rows);
        } catch (err) {
            console.error("Failed to load serial numbers", err);
            ToasterService.error("Failed to load serial numbers");
            setSerialNumbers([]);
        }
    };

    const buildPayload = () => {
        const productId = Number(formData.productId) || 0;
        const batchId = Number(formData.batchId) || 0;
        const serialNumberId = Number(formData.serialNumberId) || 0;

        const payload: Record<string, any> = {
            inspectionDate: formData.inspectionDate,
            inspector: formData.inspectorName || formData.inspector || "",
            result: String(formData.result).toUpperCase(),
            inspectionType: formData.inspectionType || null,
            remarks: formData.remarks || "",
            productId,
            batch: batchId ? { id: batchId } : null,
            serialNumber: serialNumberId ? { id: serialNumberId } : null,
        };

        if (editingId) {
            payload.id = editingId;
        }

        return payload;
    };

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const payload = buildPayload();

        try {
            setSubmitting(true);
            if (formMode === "edit" && editingId) {
                const response = await qualityInspectionApi.put(`${API_URL}/${editingId}`, payload);
                const updatedRecord = normalizeInspection({
                    ...(response.data || {}),
                    ...payload,
                    id: editingId,
                });
                setRecords(prev => prev.map(record => record.id === editingId ? updatedRecord : record));
                ToasterService.success("Inspection record updated successfully");
            } else {
                await qualityInspectionApi.post(API_URL, payload);
                ToasterService.success("Inspection record created successfully");
                await fetchRecords();
            }
            closeForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || "Save failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (record: QualityInspection) => {
        setEditingId(record.id);
        setFormData({
            productId: record.productId || 0,
            inspectionDate: record.inspectionDate.split('T')[0],
            inspectorName: record.inspectorName,
            inspector: record.inspector || record.inspectorName,
            result: record.result,
            inspectionType: record.inspectionType || "",
            remarks: record.remarks || "",
            batchId: record.batch?.id ? String(record.batch.id) : "",
            serialNumberId: record.serialNumber?.id ? String(record.serialNumber.id) : "",
        });
        setFormMode("edit");
        setShowForm(true);
    };

    const normalizeInspectionDetail = (detail: any, fallback: QualityInspection): QualityInspection =>
        normalizeInspection({ ...fallback, ...detail });

    const fetchInspectionById = async (record: QualityInspection) => {
        try {
            const response = await qualityInspectionApi.get(`${API_URL}/${record.id}`);
            return normalizeInspectionDetail(response.data, record);
        } catch (err: any) {
            console.error("Failed to load quality inspection details", err);
            ToasterService.error(err.response?.data?.message || err.response?.data?.error || "Failed to load inspection details");
            return record;
        }
    };

    const handleView = async (record: QualityInspection) => {
        const detail = await fetchInspectionById(record);
        setSelectedRecord(detail);
        setViewModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingRecord) return;

        try {
            await qualityInspectionApi.delete(`${API_URL}/${deletingRecord.id}`);
            ToasterService.success("Inspection record deleted successfully");
            await fetchRecords();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        } finally {
            setDeletingRecord(null);
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setFormMode("add");
        setEditingId(null);
        setFormData(emptyFormState);
    };

    const filtered = useMemo(() => {
        return records.filter(r => {
            const matchesSearch = (r.inspectorName || "").toLowerCase().includes(search.toLowerCase()) ||
                (r.productName?.toLowerCase().includes(search.toLowerCase()) || false) ||
                getProductDisplayName(r).toLowerCase().includes(search.toLowerCase());
            const matchesResult = resultFilter === "All" || r.result === resultFilter;
            return matchesSearch && matchesResult;
        });
    }, [records, search, resultFilter, products]);

    // Only the columns a user actually needs to read — no IDs, no nested
    // batch/serial objects, and dates formatted for display rather than ISO.
    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
            'Product': getProductDisplayName(r),
            'Inspector': r.inspectorName,
            'Inspection Date': new Date(r.inspectionDate).toLocaleDateString(),
            'Inspection Type': getInspectionTypeLabel(r.inspectionType),
            'Result': getResultLabel(r.result),
            'Batch': getBatchDisplay(r.batch),
            'Serial Number': getSerialDisplay(r.serialNumber),
            'Remarks': r.remarks || "-",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Quality Inspections");
        XLSX.writeFile(wb, `Quality_Inspection_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const pdfColumns = useMemo(
        () => [
            { header: "Product", accessor: (row: QualityInspection) => getProductDisplayName(row) },
            { header: "Inspector", key: "inspectorName" as const },
            {
                header: "Inspection Date",
                accessor: (row: QualityInspection) => new Date(row.inspectionDate).toLocaleDateString(),
            },
            { header: "Inspection Type", accessor: (row: QualityInspection) => getInspectionTypeLabel(row.inspectionType) },
            { header: "Result", accessor: (row: QualityInspection) => getResultLabel(row.result) },
            { header: "Batch", accessor: (row: QualityInspection) => getBatchDisplay(row.batch) },
            { header: "Serial Number", accessor: (row: QualityInspection) => getSerialDisplay(row.serialNumber) },
            { header: "Remarks", accessor: (row: QualityInspection) => row.remarks || "-" },
        ],
        [products]
    );

    // Calculate stats from real data
    const totalRecords = records.length;
    const passedCount = records.filter(r => r.result === "PASS").length;
    const failedCount = records.filter(r => r.result === "FAIL").length;
    const holdCount = records.filter(r => r.result === "HOLD").length;
    const rejectCount = records.filter(r => r.result === "REJECT").length;
    const passRate = totalRecords > 0 ? ((passedCount / totalRecords) * 100).toFixed(1) : "0";

    const getResultBadge = (result: string) => {
        switch (result) {
            case "PASS":
                return "bg-green-100 text-green-800 border-green-200";
            case "HOLD":
                return "bg-amber-100 text-amber-800 border-amber-200";
            case "REJECT":
                return "bg-orange-100 text-orange-800 border-orange-200";
            case "FAIL":
            default:
                return "bg-red-100 text-red-800 border-red-200";
        }
    };

    const getResultIcon = (result: string) => {
        if (result === "PASS") {
            return <CheckCircleIcon className="h-3 w-3 mr-1" />;
        }
        return <XCircleIcon className="h-3 w-3 mr-1" />;
    };

    const tableColumns: ColumnDef<QualityInspection>[] = [
        {
            key: "product",
            label: "Product",
            sortable: true,
            headerClassName: "w-[22%] text-left",
            className: "w-[22%]",
            sortValueGetter: (record) => getProductDisplayName(record),
            render: (record) => {
                const sku = getProductSku(record);
                return (
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <CubeIcon className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div className="min-w-0">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goToProduct(record.productId);
                                }}
                                className="truncate text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline text-left leading-snug"
                                title="View product"
                            >
                                {getProductDisplayName(record)}
                            </button>
                            {sku && (
                                <div className="text-xs text-slate-500 truncate mt-0.5">SKU: {sku}</div>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            key: "inspectorName",
            label: "Inspector",
            sortable: true,
            headerClassName: "w-[10%] text-left",
            className: "w-[10%]",
            render: (record) => (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <UserIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-slate-700">{record.inspectorName}</span>
                </div>
            ),
        },
        {
            key: "inspectionDate",
            label: "Inspection Date",
            sortable: true,
            headerClassName: "w-[14%] text-left",
            className: "w-[14%]",
            sortValueGetter: (record) => new Date(record.inspectionDate).getTime(),
            render: (record) => (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <span className="font-medium">{new Date(record.inspectionDate).toLocaleDateString()}</span>
                </div>
            ),
        },
        {
            key: "batch",
            label: "Batch",
            sortable: true,
            headerClassName: "w-[12%] text-left",
            className: "w-[12%]",
            sortValueGetter: (record) => getBatchDisplay(record.batch),
            render: (record) =>
                record.batch?.id ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            goToBatch(record.batch);
                        }}
                        className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                        title="View batch"
                    >
                        {getBatchDisplay(record.batch)}
                    </button>
                ) : (
                    <span className="text-sm text-slate-600">N/A</span>
                ),
        },
        {
            key: "serialNumber",
            label: "Serial Number",
            sortable: true,
            headerClassName: "w-[12%] text-left",
            className: "w-[12%]",
            sortValueGetter: (record) => getSerialDisplay(record.serialNumber),
            render: (record) =>
                record.serialNumber?.id ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            goToSerialNumber(record.serialNumber);
                        }}
                        className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                        title="View serial number"
                    >
                        {getSerialDisplay(record.serialNumber)}
                    </button>
                ) : (
                    <span className="text-sm text-slate-600">N/A</span>
                ),
        },
        {
            key: "result",
            label: "Result",
            sortable: true,
            headerClassName: "w-[10%] text-left",
            className: "w-[10%]",
            render: (record) => (
                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getResultBadge(record.result)}`}>
                    {getResultIcon(record.result)}
                    {getResultLabel(record.result)}
                </span>
            ),
        },
        {
            key: "inspectionType",
            label: "Inspection Type",
            sortable: true,
            headerClassName: "w-[10%] text-left",
            className: "w-[10%]",
            sortValueGetter: (record) => getInspectionTypeLabel(record.inspectionType),
            render: (record) => (
                <span className="text-sm text-slate-600">{getInspectionTypeLabel(record.inspectionType)}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            sortable: false,
            headerClassName: "w-[6%] text-right pr-4",
            className: "w-[6%] text-right",
            render: (record) => (
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => handleView(record)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                        title="View Details"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleEdit(record)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
                        title="Edit Inspection"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setDeletingRecord(record)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        title="Delete Inspection"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title="Quality Inspection" description="Manage quality inspection records" />
            <PageBreadcrumb pageTitle="Quality Inspection" />

            <div className="w-full max-w-none px-0 py-6">
                <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
                    <AddButton
                        label="Add Inspection"
                        onClick={() => {
                            setFormMode("add");
                            setEditingId(null);
                            setFormData(emptyFormState);
                            setShowForm(true);
                        }}
                    />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <StatsCard
                        label="Total Inspections"
                        value={totalRecords}
                        gradient="from-cyan-50 to-blue-50"
                        borderColor="border-cyan-100"
                        labelColor="text-cyan-600"
                        icon={<ClipboardDocumentCheckIcon />}
                    />
                    <StatsCard
                        label="Pass Rate"
                        value={`${passRate}%`}
                        gradient="from-green-50 to-emerald-50"
                        borderColor="border-green-100"
                        labelColor="text-green-600"
                        icon={<CheckCircleIcon />}
                    />
                    <StatsCard
                        label="Passed / Failed"
                        value={`${passedCount} / ${failedCount}`}
                        gradient="from-purple-50 to-pink-50"
                        borderColor="border-purple-100"
                        labelColor="text-purple-600"
                        icon={<ChartBarIcon />}
                    />
                </div>

                {/* Toolbar */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="search"
                                placeholder="Search by product or inspector..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <ListingPdfExportButton
                            title="Quality Inspections"
                            subtitle="Filtered quality inspection listing"
                            reportLabel="Quality Inspection Report"
                            data={filtered}
                            columns={pdfColumns}
                            dateAccessor={(row) => row.inspectionDate}
                            fileName="Quality_Inspection"
                            disabled={records.length === 0}
                            metadata={(rows, rangeLabel) => [
                                { label: "Total", value: rows.length },
                                { label: "Range", value: rangeLabel },
                                { label: "Result", value: resultFilter },
                                { label: "Search", value: search || "None" },
                            ]}
                        />

                        <button
                            onClick={exportExcel}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                            disabled={records.length === 0}
                            title="Export Excel"
                        >
                            <TableCellsIcon className="h-5 w-5 text-green-600" />
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                            disabled={records.length === 0}
                            title="Print"
                        >
                            <PrinterIcon className="h-5 w-5 text-gray-600" />
                        </button>

                        <FilterPopover
                            title="Filter Inspections"
                            buttonLabel="Filters"
                            widthClassName="w-[20rem]"
                            showFooter={false}
                        >
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                                    <select
                                        value={resultFilter}
                                        onChange={e => setResultFilter(e.target.value as any)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                    >
                                        <option value="All">All Results</option>
                                        {RESULT_OPTIONS.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {resultFilter !== "All" && (
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setResultFilter("All")}
                                            className="text-sm text-red-600 hover:text-red-800"
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        </FilterPopover>

                        {/* Refresh Button */}
                        <button
                            onClick={fetchRecords}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                            title="Refresh"
                        >
                            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                <ReusableTable
                    data={filtered}
                    columns={tableColumns}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="inspectionDate"
                    defaultSortOrder="desc"
                    loading={loading}
                    onRowClick={handleView}
                    emptyState={
                        <div className="flex flex-col items-center justify-center py-12">
                            <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-gray-500 text-sm mb-2">No inspection records found</p>
                            <p className="text-gray-400 text-xs">Click "Add Inspection" to create one</p>
                        </div>
                    }
                />

                {/* View Details Modal */}
                {viewModalOpen && selectedRecord && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Inspection Details
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
                                                        <p className="text-xs text-gray-500">Product</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => goToProduct(selectedRecord.productId)}
                                                            className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                                                        >
                                                            {getProductDisplayName(selectedRecord)}
                                                        </button>
                                                        {getProductSku(selectedRecord) && (
                                                            <p className="text-xs text-gray-500 mt-1">SKU: {getProductSku(selectedRecord)}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Inspector</p>
                                                        <p className="text-sm text-gray-700">{selectedRecord.inspectorName}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Inspection Date</p>
                                                        <p className="text-sm text-gray-700">{new Date(selectedRecord.inspectionDate).toLocaleDateString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Result</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${getResultBadge(selectedRecord.result)}`}>
                                                            {getResultIcon(selectedRecord.result)}
                                                            {getResultLabel(selectedRecord.result)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Inspection Type</p>
                                                        <p className="text-sm text-gray-700">{getInspectionTypeLabel(selectedRecord.inspectionType)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Batch</p>
                                                        {selectedRecord.batch?.id ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => goToBatch(selectedRecord.batch)}
                                                                className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                                                            >
                                                                {getBatchDisplay(selectedRecord.batch)}
                                                            </button>
                                                        ) : (
                                                            <p className="text-sm text-gray-700">N/A</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Serial Number</p>
                                                        {selectedRecord.serialNumber?.id ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => goToSerialNumber(selectedRecord.serialNumber)}
                                                                className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                                                            >
                                                                {getSerialDisplay(selectedRecord.serialNumber)}
                                                            </button>
                                                        ) : (
                                                            <p className="text-sm text-gray-700">N/A</p>
                                                        )}
                                                    </div>
                                                    {selectedRecord.remarks && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Remarks</p>
                                                            <p className="text-sm text-gray-700">{selectedRecord.remarks}</p>
                                                        </div>
                                                    )}
                                                    {selectedRecord.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Created At</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedRecord.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {(selectedRecord.result === "FAIL" || selectedRecord.result === "REJECT") && (
                                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-800">
                                                        <strong>{selectedRecord.result === "REJECT" ? "Rejected Inspection:" : "Failed Inspection:"}</strong> This product did not meet quality standards.
                                                        {selectedRecord.remarks && ` Reason: ${selectedRecord.remarks}`}
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
                                            handleEdit(selectedRecord);
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
            </div>

            <PaginatedPopup
                isOpen={showForm}
                title={formMode === "add" ? "Add Inspection Record" : "Edit Inspection Record"}
                subtitle="Enter quality inspection details from the API schema"
                onClose={closeForm}
                onSubmit={handleSave}
                submitting={submitting}
                submitLabel={formMode === "add" ? "Create" : "Update"}
                tabs={[
                    {
                        label: "Details",
                        fields: [
                            <FloatingSelect
                                key="productId"
                                label="Product"
                                name="productId"
                                value={String(formData.productId || "")}
                                onChange={(e) => {
                                    const id = Number(e.target.value) || 0;
                                    setFormData({
                                        ...formData,
                                        productId: id,
                                    });
                                }}
                                options={products.map(product => ({
                                    id: String(product.id),
                                    name: product.sku ? `${product.productName} (${product.sku})` : product.productName,
                                }))}
                                required
                            />,
                            <FloatingInput
                                key="inspectorName"
                                label="Inspector Name"
                                name="inspectorName"
                                value={formData.inspectorName}
                                onChange={(e) => setFormData({ ...formData, inspectorName: e.target.value })}
                                required
                            />,
                            <FloatingInput
                                key="inspectionDate"
                                label="Inspection Date"
                                name="inspectionDate"
                                type="date"
                                value={formData.inspectionDate}
                                onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })}
                                required
                            />,
                            <FloatingSelect
                                key="result"
                                label="Result"
                                name="result"
                                value={formData.result}
                                onChange={(e) => setFormData({ ...formData, result: e.target.value as ResultCode })}
                                options={RESULT_OPTIONS}
                                includeEmptyOption={false}
                            />,
                            <FloatingSelect
                                key="inspectionType"
                                label="Inspection Type"
                                name="inspectionType"
                                value={formData.inspectionType}
                                onChange={(e) => setFormData({ ...formData, inspectionType: e.target.value as InspectionTypeCode })}
                                options={INSPECTION_TYPE_OPTIONS}
                                required
                            />,
                            <FloatingSelect
                                key="batchId"
                                label="Batch (optional)"
                                name="batchId"
                                value={formData.batchId}
                                onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                                options={batches.map(batch => ({
                                    id: String(batch.id),
                                    name: batch.batchNumber,
                                }))}
                            />,
                            <FloatingSelect
                                key="serialNumberId"
                                label="Serial Number (optional)"
                                name="serialNumberId"
                                value={formData.serialNumberId}
                                onChange={(e) => setFormData({ ...formData, serialNumberId: e.target.value })}
                                options={serialNumbers.map(sn => ({
                                    id: String(sn.id),
                                    name: sn.serial,
                                }))}
                            />,
                        ],
                    },
                    {
                        label: "Remarks",
                        fields: [
                            <div className="md:col-span-2" key="remarks">
                                <FloatingTextarea
                                    label="Remarks (Optional)"
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    rows={3}
                                />
                            </div>,
                        ],
                    },
                ]}
            />

            <DynamicPopup
                isPopupOpen={!!deletingRecord}
                setIsPopupOpen={(open: boolean) => {
                    if (!open) setDeletingRecord(null);
                }}
                icon={<TrashIcon className="h-6 w-6 text-red-600" />}
                iconBg="bg-red-100"
                innerText="Delete Inspection Record"
                subText={
                    deletingRecord
                        ? `Are you sure you want to delete the inspection record for "${getProductDisplayName(deletingRecord)}"? This action cannot be undone.`
                        : "Are you sure you want to delete this inspection record?"
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setDeletingRecord(null)}
                confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
            />
        </>
    );
};

export default QualityInspectionManager;