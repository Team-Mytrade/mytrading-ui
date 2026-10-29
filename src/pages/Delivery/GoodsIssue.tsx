import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  CheckCircleIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { todayIso } from "../../utils/localDate";
import { DELIVERY_API, apiError, useDeliveryLookups } from "./deliveryShared";
import { usePermissions } from "../../access/usePermissions";

import { t } from "../../i18n/i18n";
// A goods issue records what left the warehouse against a delivery note: drafted, then posted (or
// cancelled). Quantities can never exceed what is still open on the note. Stock itself is taken out
// of inventory by the sales dispatch.

// ─── Types ────────────────────────────────────────────────────────────────────

type IssueStatus = "DRAFT" | "POSTED" | "CANCELLED";

const STATUS_OPTIONS: IssueStatus[] = ["DRAFT", "POSTED", "CANCELLED"];

const STATUS_LABELS: Record<IssueStatus, string> = { DRAFT: "Draft", POSTED: "Posted", CANCELLED: "Cancelled" };

const STATUS_STYLES: Record<IssueStatus, string> = {
  DRAFT:     "bg-gray-100  text-gray-600 border-gray-200/60",
  POSTED:    "bg-green-100 text-green-800 border-green-200/60",
  CANCELLED: "bg-red-100   text-red-800 border-red-200/60",
};

interface GoodsIssueItem {
  id?: number;
  productId: number;
  quantity: number;
}

interface GoodsIssueForm {
  id?: number;
  issueNo?: string;
  issueDate: string;
  deliveryNoteId: number;
  items: GoodsIssueItem[];
}

interface GoodsIssueRecord {
  id: number;
  issueNo: string;
  issueDate: string;
  deliveryNoteId: number;
  deliveryNoteNo?: string;
  status: IssueStatus;
  createdDate?: string;
  items: GoodsIssueItem[];
}

interface DeliveryNoteOption {
  id: number;
  deliveryNo: string;
  status?: string;
  items: { productId: number; orderedQty: number; deliveredQty?: number }[];
}

const emptyItem = (): GoodsIssueItem => ({ productId: 0, quantity: 0 });

const emptyForm = (): GoodsIssueForm => ({ issueDate: todayIso(), deliveryNoteId: 0, items: [] });

const API_URL            = `${DELIVERY_API}/goods-issues`;
const DELIVERY_NOTES_URL = `${DELIVERY_API}/delivery-notes`;

// What a note allows per line: the delivered quantity once recorded, else the ordered one
const noteLines = (note?: DeliveryNoteOption): GoodsIssueItem[] =>
  (note?.items ?? []).map(i => ({ productId: i.productId, quantity: i.deliveredQty && i.deliveredQty > 0 ? i.deliveredQty : i.orderedQty }));

// ─── Page ─────────────────────────────────────────────────────────────────────

const GoodsIssuePage: React.FC = () => {
  const { canCreate, canDelete, canUpdate } = usePermissions();
  const lookups = useDeliveryLookups(["products"]);
  const [form, setForm] = useState<GoodsIssueForm>(emptyForm());

  const [records, setRecords]             = useState<GoodsIssueRecord[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const [search, setSearch]             = useState("");
  const [activeFilter, setActiveFilter] = useState<IssueStatus | "ALL">("ALL");
  const [showFilters, setShowFilters]   = useState(false);

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingRecord, setDeletingRecord]   = useState<GoodsIssueRecord | null>(null);
  const [statusChange, setStatusChange]       = useState<{ record: GoodsIssueRecord; status: IssueStatus } | null>(null);

  // ---------- Data loading ----------
  useEffect(() => {
    loadGoodsIssues();
    loadDeliveryNotes();
  }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  const loadGoodsIssues = async () => {
    setLoading(true);
    try {
      const res = await axios.get<GoodsIssueRecord[]>(API_URL);
      setRecords(res.data);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load goods issues"));
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryNotes = async () => {
    try {
      const res = await axios.get<DeliveryNoteOption[]>(DELIVERY_NOTES_URL);
      setDeliveryNotes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const noteLabel = (r: Pick<GoodsIssueRecord, "deliveryNoteId" | "deliveryNoteNo">) =>
    r.deliveryNoteNo || deliveryNotes.find(n => n.id === r.deliveryNoteId)?.deliveryNo || `#${r.deliveryNoteId}`;

  const selectedNote = deliveryNotes.find(n => n.id === form.deliveryNoteId);

  // ---------- Form helpers ----------
  const resetForm = () => {
    setForm(emptyForm());
    setShowForm(false);
  };

  const handleAddNew = () => {
    setForm(emptyForm());
    setShowForm(true);
  };

  // Choosing a note proposes all of its lines; trim them to what is actually leaving
  const chooseNote = (noteId: number) => {
    const note = deliveryNotes.find(n => n.id === noteId);
    setForm(prev => ({ ...prev, deliveryNoteId: noteId, items: noteLines(note) }));
  };

  const addItem = () =>
    setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));

  const removeItem = (index: number) =>
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const updateItem = <K extends keyof GoodsIssueItem>(index: number, key: K, value: GoodsIssueItem[K]) =>
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));

  // ---------- CRUD handlers ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.issueDate || !form.deliveryNoteId) {
      ToasterService.error("Choose a delivery note and the issue date");
      return;
    }
    if (form.items.some(i => !i.productId || !(i.quantity > 0))) {
      ToasterService.error("Every line needs a product and a quantity greater than 0");
      return;
    }

    setSaving(true);
    // No lines: the service issues everything still open on the note
    const payload = {
      deliveryNoteId: form.deliveryNoteId,
      issueDate: form.issueDate,
      items: form.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    };

    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload);
        ToasterService.success("Goods issue updated");
      } else {
        const { data } = await axios.post<GoodsIssueRecord>(API_URL, payload);
        ToasterService.success(`Goods issue ${data.issueNo} created as a draft`);
      }
      await loadGoodsIssues();
      resetForm();
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to save goods issue"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: GoodsIssueRecord) => {
    setForm({
      id: record.id,
      issueNo: record.issueNo,
      issueDate: record.issueDate,
      deliveryNoteId: record.deliveryNoteId,
      items: record.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    });
    setShowForm(true);
  };

  const handleDelete = (record: GoodsIssueRecord) => {
    setDeletingRecord(record);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingRecord) return;
    try {
      await axios.delete(`${API_URL}/${deletingRecord.id}`);
      ToasterService.success("Goods issue deleted");
      setRecords(prev => prev.filter(r => r.id !== deletingRecord.id));
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to delete goods issue"));
    } finally {
      setShowDeletePopup(false);
      setDeletingRecord(null);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusChange) return;
    const { record, status } = statusChange;
    try {
      await axios.put(`${API_URL}/${record.id}/status`, { status });
      ToasterService.success(`${record.issueNo} ${status === "POSTED" ? "posted" : "cancelled"}`);
      await loadGoodsIssues();
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to change the status"));
    } finally {
      setStatusChange(null);
    }
  };

  // ---------- Derived: search + filter ----------
  const filteredRecords = useMemo(() => {
    const term = search.toLowerCase();
    return records.filter(r => {
      const matchesSearch =
        (r.issueNo ?? "").toLowerCase().includes(term) ||
        noteLabel(r).toLowerCase().includes(term) ||
        STATUS_LABELS[r.status].toLowerCase().includes(term);
      const matchesFilter = activeFilter === "ALL" || r.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, search, activeFilter, deliveryNotes]);

  const stats = useMemo(() => ({
    total:     records.length,
    draft:     records.filter(r => r.status === "DRAFT").length,
    posted:    records.filter(r => r.status === "POSTED").length,
    cancelled: records.filter(r => r.status === "CANCELLED").length,
  }), [records]);

  // Products on the chosen note first; a line keeps its product even if it is not on the note
  const productOptions = (current: number) => {
    const onNote = new Set(selectedNote?.items.map(i => i.productId) ?? []);
    const ids = new Set<number>([...onNote, ...(current ? [current] : [])]);
    return [...ids].map(id => ({ id, name: lookups.productName(id) }));
  };

  // ---------- Table columns ----------
  const columns: ColumnDef<GoodsIssueRecord>[] = [
    {
      key: "issueNo",
      label: "Issue No.",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">{r.issueNo || "—"}</span>
        </div>
      ),
    },
    {
      key: "issueDate",
      label: "Issue Date",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (r) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CalendarDaysIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="font-medium">{r.issueDate}</span>
        </div>
      ),
    },
    {
      key: "deliveryNoteNo",
      label: "Delivery Note",
      sortable: true,
      sortValueGetter: (r) => noteLabel(r),
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (r) => <span className="text-sm text-slate-600 truncate">{noteLabel(r)}</span>,
    },
    {
      key: "items",
      label: "Lines",
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      render: (r) => (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40"
          title={r.items.map(i => `${lookups.productName(i.productId)} × ${i.quantity}`).join("\n")}
        >
          <ClipboardDocumentListIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {r.items?.length ?? 0}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (r) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[25%] text-right pr-4",
      className: "w-[25%] text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {r.status === "DRAFT" && (
            <>
              {canUpdate && (<button type="button" onClick={() => setStatusChange({ record: r, status: "POSTED" })} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-green-50 hover:text-green-600" title={t("Post")}>
                <CheckCircleIcon className="h-4 w-4" />
              </button>)}
              {canUpdate && (<button type="button" onClick={() => handleEdit(r)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit")}>
                <PencilSquareIcon className="h-4 w-4" />
              </button>)}
            </>
          )}
          {r.status !== "CANCELLED" && (
            canUpdate && <button type="button" onClick={() => setStatusChange({ record: r, status: "CANCELLED" })} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600" title={t("Cancel")}>
              <NoSymbolIcon className="h-4 w-4" />
            </button>
          )}
          {r.status !== "POSTED" && (
            canDelete && <button type="button" onClick={() => handleDelete(r)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title={t("Delete")}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Notes that can still be issued against (not cancelled), plus the one being edited
  const noteOptions = deliveryNotes
    .filter(n => n.status !== "CANCELLED" || n.id === form.deliveryNoteId)
    .map(d => ({ id: String(d.id), name: d.deliveryNo ?? `#${d.id}` }));

  // ---------- Render ----------
  return (
    <>
      <PageMeta title={t("Goods Issue")} description="Record goods leaving the warehouse against delivery notes" />
      <PageBreadcrumb pageTitle="Goods Issue" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton label={t("Add Goods Issue")} onClick={handleAddNew} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard label={t("Total Goods Issues")} value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Draft")} value={stats.draft} gradient="from-gray-50 to-slate-50" borderColor="border-gray-200" labelColor="text-gray-500" />
          <StatsCard label={t("Posted")} value={stats.posted} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Cancelled")} value={stats.cancelled} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t("Search by issue number, delivery note, or status...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            <button title={t("Filters")} aria-label={t("Filters")}
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-lg border p-2 flex items-center justify-center transition-colors h-[40px] w-[40px] ${
                showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-slide-down">
            <div className="flex flex-wrap gap-4">
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
                <FloatingSelect
                  label={t("Filter by Status")}
                  name="filter"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as IssueStatus | "ALL")}
                  includeEmptyOption={false}
                  className="!mb-0"
                  options={[{ id: "ALL", name: "All Statuses" }, ...STATUS_OPTIONS.map(s => ({ id: s, name: STATUS_LABELS[s] }))]}
                />
              </div>
              {activeFilter !== "ALL" && (
                <button onClick={() => setActiveFilter("ALL")} className="self-end mb-1 text-sm text-red-600 hover:text-red-800">
                  {t("Clear Filter")}
                </button>
              )}
            </div>
          </div>
        )}

        <ReusableTable<GoodsIssueRecord>
          data={filteredRecords}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="issueDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">{t("No goods issues found")}</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">{t("Try adjusting your search or filters")}</p>
              ) : (
                canCreate && <button type="button" onClick={handleAddNew} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                  {t("Create your first goods issue")}
                </button>
              )}
            </div>
          }
        />

        {showForm &&
          createPortal(
            <div
              key="goods-issue-modal"
              className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {form.id ? `Edit ${form.issueNo ?? "Goods Issue"}` : t("Create Goods Issue")}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t("Saved as a draft. Quantities cannot exceed what is still open on the delivery note.")}
                    </p>
                  </div>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <FloatingSelect
                      label={t("Delivery Note")}
                      name="deliveryNoteId"
                      value={form.deliveryNoteId ? String(form.deliveryNoteId) : ""}
                      onChange={(e) => chooseNote(Number(e.target.value))}
                      includeEmptyOption
                      required
                      options={noteOptions}
                    />
                    <FloatingInput
                      label={t("Issue Date")}
                      name="issueDate"
                      type="date"
                      value={form.issueDate}
                      onChange={(e) => setForm(prev => ({ ...prev, issueDate: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-900">{t("Lines")}</label>
                      <button
                        type="button"
                        onClick={addItem}
                        disabled={!form.deliveryNoteId}
                        className="inline-flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700 disabled:opacity-40"
                      >
                        <PlusIcon className="h-4 w-4" />
                        {t("Add Line")}
                      </button>
                    </div>

                    {!form.deliveryNoteId ? (
                      <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">{t("Choose a delivery note to load its lines.")}</p>
                    ) : form.items.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                        {t("No lines: everything still open on")} {selectedNote?.deliveryNo ?? "the note"} will be issued.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {form.items.map((item, index) => (
                          <div key={index} className="grid grid-cols-[1fr_8rem_auto] gap-3 items-end bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="min-w-0">
                              <label className="block text-xs font-medium text-gray-500 mb-1">{t("Product")}</label>
                              <select
                                value={item.productId}
                                onChange={(e) => updateItem(index, "productId", Number(e.target.value))}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                              >
                                <option value={0} disabled>{t("Select product")}</option>
                                {productOptions(item.productId).map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">{t("Quantity")}</label>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              title={t("Remove line")}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                    <button type="button" onClick={resetForm} className="px-4 py-2 !mb-0 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                      {t("Cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm disabled:opacity-60"
                    >
                      {saving ? "Saving..." : form.id ? "Update Goods Issue" : "Create Draft"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
      </div>

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText={t("Delete Goods Issue")}
        subText={`Are you sure you want to delete "${deletingRecord?.issueNo ?? "this goods issue"}"? This action cannot be undone.`}
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRecord(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      <DynamicPopup
        isPopupOpen={statusChange !== null}
        setIsPopupOpen={(open: boolean) => { if (!open) setStatusChange(null); }}
        icon={statusChange?.status === "POSTED"
          ? <CheckCircleIcon className="h-6 w-6 text-green-600" />
          : <NoSymbolIcon className="h-6 w-6 text-amber-600" />}
        iconBg={statusChange?.status === "POSTED" ? "bg-green-100" : "bg-amber-100"}
        innerText={statusChange?.status === "POSTED" ? "Post Goods Issue" : "Cancel Goods Issue"}
        subText={statusChange?.status === "POSTED"
          ? `Post "${statusChange?.record.issueNo}"? A posted goods issue can no longer be edited or deleted, only cancelled.`
          : `Cancel "${statusChange?.record.issueNo}"? Its quantities become available on the delivery note again.`}
        confirmLabel={statusChange?.status === "POSTED" ? "Post" : "Cancel Issue"}
        cancelLabel={t("Back")}
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusChange(null)}
        confirmBtnClass={statusChange?.status === "POSTED"
          ? "bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white"
          : "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white"}
      />

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
};

export default GoodsIssuePage;
