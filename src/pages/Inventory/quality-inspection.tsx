import React, { useContext, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { ToasterService } from "../../Services/ToasterService";
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

interface Product { id: number; productName: string; sku?: string; code?: string; }
type ResultCode = "PASS" | "FAIL" | "HOLD" | "REJECT";
type InspectionTypeCode = "INCOMING" | "RETURN" | "RANDOM" | "AUDIT";
interface EnumOption { id: string; name: string; }

const DEFAULT_RESULT_OPTIONS: EnumOption[] = [
  { id: "PASS", name: "Pass" },
  { id: "FAIL", name: "Fail" },
  { id: "HOLD", name: "Hold" },
  { id: "REJECT", name: "Reject" },
];
const DEFAULT_INSPECTION_TYPE_OPTIONS: EnumOption[] = [
  { id: "INCOMING", name: "Incoming" },
  { id: "RETURN", name: "Return" },
  { id: "RANDOM", name: "Random" },
  { id: "AUDIT", name: "Audit" },
];

const toTitleCase = (value: string) =>
  value.toLowerCase().split(/[\s_-]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const normalizeEnumOptions = (raw: any, fallback: EnumOption[]): EnumOption[] => {
  const list = Array.isArray(raw) ? raw : raw?.content || raw?.data || raw?.result || [];
  if (!Array.isArray(list) || list.length === 0) return fallback;
  const options: EnumOption[] = list.map((item: any): EnumOption | null => {
    if (typeof item === "string") return { id: item.toUpperCase(), name: toTitleCase(item) };
    if (item && typeof item === "object") {
      const id = item.id ?? item.value ?? item.code ?? item.key ?? item.name;
      const name = item.name ?? item.label ?? item.description ?? item.value ?? id;
      if (id == null) return null;
      return { id: String(id).toUpperCase(), name: String(name ?? id) };
    }
    return null;
  }).filter((o): o is EnumOption => o !== null);
  return options.length > 0 ? options : fallback;
};

interface QualityInspection {
  id: number; productName?: string; productId?: number;
  inspectionDate: string; inspectorName: string; inspector?: string;
  result: ResultCode; inspectionType?: InspectionTypeCode; remarks?: string;
  createdAt?: string; updatedAt?: string; createdDate?: string; updatedDate?: string;
}

const API_BASE = "/v1/api/inventory";
const API_URL = `${API_BASE}/quality-inspections`;
const PRODUCTS_API_URL = "/v1/api/purchase/products";
const RESULT_ENUM_URL = `${API_BASE}/enums?type=RESULT`;
const INSPECTION_TYPE_ENUM_URL = `${API_BASE}/enums?type=INSPECTION_TYPE`;
const qualityInspectionApi = axios.create();
qualityInspectionApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const PAGE_SIZE = 10;
const PRODUCT_ROUTE = "/purchase-products";

type FormState = {
  productId: number; inspectionDate: string; inspectorName: string;
  inspector: string; result: ResultCode; inspectionType: InspectionTypeCode | ""; remarks: string;
};
const emptyFormState: FormState = {
  productId: 0, inspectionDate: new Date().toISOString().split("T")[0],
  inspectorName: "", inspector: "", result: "PASS", inspectionType: "", remarks: "",
};

const QualityInspectionManager: React.FC = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [records, setRecords] = useState<QualityInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<QualityInspection | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<QualityInspection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [resultOptions, setResultOptions] = useState<EnumOption[]>(DEFAULT_RESULT_OPTIONS);
  const [inspectionTypeOptions, setInspectionTypeOptions] = useState<EnumOption[]>(DEFAULT_INSPECTION_TYPE_OPTIONS);
  const [formData, setFormData] = useState<FormState>(emptyFormState);

  useEffect(() => {
    fetchRecords();
    fetchProducts();
    fetchResultOptions();
    fetchInspectionTypeOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getResultLabel = (result: string) => resultOptions.find((r) => r.id === result)?.name || result;
  const getInspectionTypeLabel = (type?: string) => inspectionTypeOptions.find((t) => t.id === type)?.name || type || "N/A";
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
  const goToProduct = (productId?: number) => {
    if (!productId) return;
    navigate(`${PRODUCT_ROUTE}?productId=${productId}`, { state: { productId } });
  };

  const normalizeInspection = (record: any): QualityInspection => {
    const rawResult = String(record?.result || "PASS").toUpperCase();
    const result: ResultCode = DEFAULT_RESULT_OPTIONS.some((r) => r.id === rawResult) ? (rawResult as ResultCode) : "PASS";
    const rawType = record?.inspectionType ? String(record.inspectionType).toUpperCase() : undefined;
    const inspectionType: InspectionTypeCode | undefined = DEFAULT_INSPECTION_TYPE_OPTIONS.some((t) => t.id === rawType)
      ? (rawType as InspectionTypeCode) : undefined;
    return {
      ...record,
      id: record?.id ?? 0,
      productName: record?.productName || record?.product?.name || "",
      productId: record?.productId,
      inspectionDate: record?.inspectionDate || new Date().toISOString().split("T")[0],
      inspectorName: record?.inspectorName || record?.inspector || "",
      inspector: record?.inspector || record?.inspectorName || "",
      result, inspectionType,
      remarks: record?.remarks || "",
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

  const fetchResultOptions = async () => {
    try {
      const res = await qualityInspectionApi.get(RESULT_ENUM_URL);
      setResultOptions(normalizeEnumOptions(res.data, DEFAULT_RESULT_OPTIONS));
    } catch (err) {
      console.error("Failed to load result enum options, using defaults", err);
      setResultOptions(DEFAULT_RESULT_OPTIONS);
    }
  };

  const fetchInspectionTypeOptions = async () => {
    try {
      const res = await qualityInspectionApi.get(INSPECTION_TYPE_ENUM_URL);
      setInspectionTypeOptions(normalizeEnumOptions(res.data, DEFAULT_INSPECTION_TYPE_OPTIONS));
    } catch (err) {
      console.error("Failed to load inspection type enum options, using defaults", err);
      setInspectionTypeOptions(DEFAULT_INSPECTION_TYPE_OPTIONS);
    }
  };

  const buildPayload = () => {
    const productId = Number(formData.productId) || 0;
    const payload: Record<string, any> = {
      inspectionDate: formData.inspectionDate,
      inspector: formData.inspectorName || formData.inspector || "",
      result: String(formData.result).toUpperCase(),
      inspectionType: formData.inspectionType || null,
      remarks: formData.remarks || "",
      productId,
    };
    if (editingId) payload.id = editingId;
    return payload;
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const payload = buildPayload();
    try {
      setSubmitting(true);
      if (formMode === "edit" && editingId) {
        const response = await qualityInspectionApi.put(`${API_URL}/${editingId}`, payload);
        const updatedRecord = normalizeInspection({ ...(response.data || {}), ...payload, id: editingId });
        setRecords((prev) => prev.map((r) => (r.id === editingId ? updatedRecord : r)));
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
      inspectionDate: record.inspectionDate.split("T")[0],
      inspectorName: record.inspectorName,
      inspector: record.inspector || record.inspectorName,
      result: record.result,
      inspectionType: record.inspectionType || "",
      remarks: record.remarks || "",
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

  const totalRecords = records.length;
  const passedCount = records.filter((r) => r.result === "PASS").length;
  const failedCount = records.filter((r) => r.result === "FAIL").length;
  const passRate = totalRecords > 0 ? ((passedCount / totalRecords) * 100).toFixed(1) : "0";

  const getResultBadge = (result: string) => {
    switch (result) {
      case "PASS": return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800";
      case "HOLD": return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800";
      case "REJECT": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800";
      case "FAIL":
      default: return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800";
    }
  };
  const getResultIcon = (result: string) =>
    result === "PASS" ? <CheckCircleIcon className="mr-1 h-3 w-3" /> : <XCircleIcon className="mr-1 h-3 w-3" />;

  const tableColumns: ColumnDef<QualityInspection>[] = [
    {
      key: "product", label: "Product", sortable: true,
      headerClassName: "w-[28%] text-left", className: "w-[28%]",
      sortValueGetter: (record) => getProductDisplayName(record),
      render: (record) => {
        const sku = getProductSku(record);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm dark:border-cyan-800">
              <CubeIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="min-w-0">
              <button type="button"
                onClick={(e) => { e.stopPropagation(); goToProduct(record.productId); }}
                className="truncate text-left text-sm font-semibold leading-snug text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
                title="View product">
                {getProductDisplayName(record)}
              </button>
              {sku && <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">SKU: {sku}</div>}
            </div>
          </div>
        );
      },
    },
    {
      key: "inspectorName", label: "Inspector", sortable: true,
      headerClassName: "w-[14%] text-left", className: "w-[14%]",
      render: (record) => (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <UserIcon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="truncate font-medium text-slate-700 dark:text-slate-200">{record.inspectorName}</span>
        </div>
      ),
    },
    {
      key: "inspectionDate", label: "Inspection Date", sortable: true,
      headerClassName: "w-[18%] text-left", className: "w-[18%]",
      sortValueGetter: (record) => new Date(record.inspectionDate).getTime(),
      render: (record) => (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <CalendarIcon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="font-medium">{new Date(record.inspectionDate).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      key: "result", label: "Result", sortable: true,
      headerClassName: "w-[14%] text-left", className: "w-[14%]",
      render: (record) => (
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getResultBadge(record.result)}`}>
          {getResultIcon(record.result)}{getResultLabel(record.result)}
        </span>
      ),
    },
    {
      key: "inspectionType", label: "Inspection Type", sortable: true,
      headerClassName: "w-[14%] text-left", className: "w-[14%]",
      sortValueGetter: (record) => getInspectionTypeLabel(record.inspectionType),
      render: (record) => (
        <span className="text-sm text-slate-600 dark:text-slate-300">{getInspectionTypeLabel(record.inspectionType)}</span>
      ),
    },
    {
      key: "actions", label: "Actions", sortable: false,
      headerClassName: "w-[12%] text-right pr-4", className: "w-[12%] text-right",
      render: (record) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => handleView(record)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
            title="View Details"><ClipboardDocumentCheckIcon className="h-4 w-4" /></button>
          <button type="button" onClick={() => handleEdit(record)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="Edit Inspection"><PencilSquareIcon className="h-4 w-4" /></button>
          <button type="button" onClick={() => setDeletingRecord(record)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete Inspection"><TrashIcon className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Quality Inspection" description="Manage quality inspection records" />
      <PageBreadcrumb pageTitle="Quality Inspection"
        actions={<AddButton label="Add Inspection" onClick={() => { setFormMode("add"); setEditingId(null); setFormData(emptyFormState); setShowForm(true); }} />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard label="Total Inspections" value={totalRecords} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<ClipboardDocumentCheckIcon />} />
          <StatsCard label="Pass Rate" value={`${passRate}%`} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon />} />
          <StatsCard label="Passed / Failed" value={`${passedCount} / ${failedCount}`} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<ChartBarIcon />} />
        </div>

        {/* ✅ Only valid props — no renderRowDetails / rowDetailsRender */}
        <ReusableTable
          data={records}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="inspectionDate"
          defaultSortOrder="desc"
          loading={loading}
          enableRowDetails={true}
          rowDetailsTitle="Inspection Details"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardDocumentCheckIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">No inspection records found</p>
              <button type="button" onClick={() => { setFormMode("add"); setEditingId(null); setFormData(emptyFormState); setShowForm(true); }}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">
                Create your first inspection record
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={viewModalOpen}
        title="Inspection Details"
        subtitle={selectedRecord ? `Inspection record #${selectedRecord.id}` : "Inspection record details"}
        onClose={() => setViewModalOpen(false)}
        submitting={false}
        maxWidthClassName="max-w-2xl"
        tabs={[{ label: "Details", fields: [
          selectedRecord && (
            <div key="view-content" className="md:col-span-2 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Record ID</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">#{selectedRecord.id}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Product</div>
                <button type="button" onClick={() => goToProduct(selectedRecord.productId)}
                  className="mt-1 text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300">
                  {getProductDisplayName(selectedRecord)}
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">SKU</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{getProductSku(selectedRecord) || "--"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Inspector</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedRecord.inspectorName || "--"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Inspection Date</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{new Date(selectedRecord.inspectionDate).toLocaleDateString()}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Inspection Type</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{getInspectionTypeLabel(selectedRecord.inspectionType)}</div>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Result</div>
                <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getResultBadge(selectedRecord.result)}`}>
                  {getResultIcon(selectedRecord.result)}{getResultLabel(selectedRecord.result)}
                </span>
              </div>
              {selectedRecord.remarks && (
                <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Remarks</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{selectedRecord.remarks}</p>
                </div>
              )}
              {(selectedRecord.result === "FAIL" || selectedRecord.result === "REJECT") && (
                <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
                  <p className="text-sm text-red-800 dark:text-red-300">
                    <strong>{selectedRecord.result === "REJECT" ? "Rejected Inspection:" : "Failed Inspection:"}</strong>{" "}
                    This product did not meet quality standards.
                  </p>
                </div>
              )}
            </div>
          ),
        ]}]}
      />

      <PaginatedPopup
        isOpen={showForm}
        title={formMode === "add" ? "Add Inspection Record" : "Edit Inspection Record"}
        subtitle="Enter quality inspection details from the API schema"
        onClose={closeForm}
        onSubmit={handleSave}
        submitting={submitting}
        submitLabel={formMode === "add" ? "Create" : "Update"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          { label: "Details", fields: [
            <FloatingSelect key="productId" label="Product" name="productId"
              value={String(formData.productId || "")}
              onChange={(e) => { const id = Number(e.target.value) || 0; setFormData({ ...formData, productId: id }); }}
              options={products.map((p) => ({ id: String(p.id), name: p.sku ? `${p.productName} (${p.sku})` : p.productName }))}
              required
            />,
            <FloatingInput key="inspectorName" label="Inspector Name" name="inspectorName"
              value={formData.inspectorName} onChange={(e) => setFormData({ ...formData, inspectorName: e.target.value })} required />,
            <FloatingInput key="inspectionDate" label="Inspection Date" name="inspectionDate" type="date"
              value={formData.inspectionDate} onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })} required />,
            <FloatingSelect key="result" label="Result" name="result"
              value={formData.result} onChange={(e) => setFormData({ ...formData, result: e.target.value as ResultCode })}
              options={resultOptions} includeEmptyOption={false} />,
            <FloatingSelect key="inspectionType" label="Inspection Type" name="inspectionType"
              value={formData.inspectionType} onChange={(e) => setFormData({ ...formData, inspectionType: e.target.value as InspectionTypeCode })}
              options={inspectionTypeOptions} required />,
          ]},
          { label: "Remarks", fields: [
            <div className="md:col-span-2" key="remarks">
              <FloatingTextarea label="Remarks (Optional)" name="remarks" value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} rows={3} />
            </div>,
          ]},
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deletingRecord}
        setIsPopupOpen={(open: boolean) => { if (!open) setDeletingRecord(null); }}
        icon={<TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconBg="bg-red-100 dark:bg-red-950/40"
        innerText="Delete Inspection Record"
        subText={deletingRecord ? `Are you sure you want to delete the inspection record for "${getProductDisplayName(deletingRecord)}"? This action cannot be undone.` : "Are you sure you want to delete this inspection record?"}
        confirmLabel="Delete" cancelLabel="Cancel"
        onConfirm={confirmDelete} onCancel={() => setDeletingRecord(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default QualityInspectionManager;