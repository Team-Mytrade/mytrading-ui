import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import { FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface JournalEntry {
  id: number;
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  sourceModule?: string;
  sourceId?: number;
}

const API_URL = "/v1/api/invoice/journal-entries";
const PAGE_SIZE = 10;

const SOURCE_MODULE_OPTIONS = [
  { id: "SALES_INVOICE", name: "SALES_INVOICE" },
  { id: "PURCHASE_INVOICE", name: "PURCHASE_INVOICE" },
  { id: "CREDIT_NOTE", name: "CREDIT_NOTE" },
  { id: "DEBIT_NOTE", name: "DEBIT_NOTE" },
  { id: "ADJUSTMENT_NOTE", name: "ADJUSTMENT_NOTE" },
  { id: "OTHER", name: "OTHER" },
];

const sourceTones: Record<string, string> = {
  SALES_INVOICE: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  PURCHASE_INVOICE: "bg-blue-50 text-blue-700 border-blue-200/40",
  CREDIT_NOTE: "bg-purple-50 text-purple-700 border-purple-200/40",
  DEBIT_NOTE: "bg-orange-50 text-orange-700 border-orange-200/40",
  ADJUSTMENT_NOTE: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  OTHER: "bg-gray-50 text-gray-700 border-gray-200/40",
};

const JournalEntries: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [form, setForm] = useState<Partial<JournalEntry>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [generalAccounts, setGeneralAccounts] = useState<{id:number;accountName?:string;accountCode?:string}[]>([]);
  const [entryLines, setEntryLines] = useState<{generalAccountId:number|string;debit:number;credit:number;narration:string}[]>([{generalAccountId:"",debit:0,credit:0,narration:""}]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEntries();
    axios.get("/v1/api/invoice/general-accounts", { headers }).then(r => setGeneralAccounts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<JournalEntry[]>(API_URL, { headers });
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching journal entries", err);
      ToasterService.error("Failed to load journal entries");
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.entryNumber?.trim()) {
      ToasterService.error("Entry number is required");
      return;
    }
    const validLines = entryLines.filter(l => l.generalAccountId);
    if (!validLines.length) {
      ToasterService.error("Add at least one entry line with an account");
      return;
    }
    const totalDebit = validLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = validLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (totalDebit !== totalCredit) {
      ToasterService.error("Total debit and credit must be equal");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        entryNumber: form.entryNumber,
        entryDate: form.entryDate,
        sourceModule: form.sourceModule,
        sourceId: form.sourceId ? Number(form.sourceId) : undefined,
        description: form.description,
        entries: validLines.map(l => ({
          generalAccountId: Number(l.generalAccountId),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration,
        })),
      };
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, payload, { headers })
          : await axios.post(API_URL, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Journal entry updated successfully!" : "Journal entry added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchEntries();
      }
    } catch (err: any) {
      console.error("Error submitting journal entry", err);
      ToasterService.error(err?.response?.data?.error || "Failed to save journal entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setForm(entry);
    setEditingId(entry.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    setForm({});
    setEditingId(null);
    setEntryLines([{generalAccountId:"",debit:0,credit:0,narration:""}]);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
    setEntryLines([{generalAccountId:"",debit:0,credit:0,narration:""}]);
  };

  const handleDelete = (entry: JournalEntry) => {
    setEntryToDelete(entry);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await axios.delete(`${API_URL}/${entryToDelete.id}`, { headers });
      ToasterService.success("Journal entry deleted successfully!");
      setShowDeletePopup(false);
      setEntryToDelete(null);
      fetchEntries();
    } catch (err) {
      console.error("Error deleting journal entry", err);
      ToasterService.error("Failed to delete journal entry");
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (entry.entryNumber || "").toLowerCase().includes(term) ||
        (entry.description || "").toLowerCase().includes(term) ||
        (entry.sourceModule || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "SALES_INVOICE") {
        matchesFilter = entry.sourceModule === "SALES_INVOICE";
      } else if (activeFilter === "PURCHASE_INVOICE") {
        matchesFilter = entry.sourceModule === "PURCHASE_INVOICE";
      }

      return matchesSearch && matchesFilter;
    });
  }, [entries, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalEntries: entries.length,
      salesInvoices: entries.filter((e) => e.sourceModule === "SALES_INVOICE").length,
      purchaseInvoices: entries.filter((e) => e.sourceModule === "PURCHASE_INVOICE").length,
    }),
    [entries]
  );

  const tableColumns: ColumnDef<JournalEntry>[] = [
    {
      key: "entryNumber",
      label: "Entry Number",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (entry) => (
        <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
          {entry.entryNumber || "N/A"}
        </span>
      ),
    },
    {
      key: "entryDate",
      label: "Entry Date",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (entry) => (
        <span className="text-sm text-slate-600 truncate">{entry.entryDate || "N/A"}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (entry) => (
        <span className="text-sm text-slate-600 truncate">{entry.description || "N/A"}</span>
      ),
    },
    {
      key: "sourceModule",
      label: "Source Module",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (entry) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
          sourceTones[entry.sourceModule || "OTHER"] || "bg-gray-50 text-gray-700 border-gray-200/40"
        }`}>
          {entry.sourceModule || "OTHER"}
        </span>
      ),
    },
    {
      key: "sourceId",
      label: "Source ID",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      sortValueGetter: (entry) => Number(entry.sourceId || 0),
      render: (entry) => (
        <span className="text-sm text-slate-600 truncate">{entry.sourceId || "N/A"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (entry) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(entry)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Journal Entry"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(entry)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Journal Entry"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Journal Entries" description="Manage invoice journal entries" />
      <PageBreadcrumb pageTitle="Journal Entries" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Journal Entry" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Entries"
            value={stats.totalEntries}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Sales Invoices"
            value={stats.salesInvoices}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Purchase Invoices"
            value={stats.purchaseInvoices}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredEntries.length}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search entries by number, description, or source..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            <FilterPopover
              title="Filter Entries"
              buttonLabel="Filters"
              label="Filter by Source Module"
              value={activeFilter}
              options={[
                { label: "All Entries", value: "ALL" },
                { label: "Sales Invoice", value: "SALES_INVOICE" },
                { label: "Purchase Invoice", value: "PURCHASE_INVOICE" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredEntries}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="entryNumber"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No journal entries found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first journal entry
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Journal Entry" : "Create New Journal Entry"}
          subtitle={editingId !== null ? "Update your journal entry" : "Add a new journal entry"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Entry" : "Create Entry"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Entry Details",
              fields: [
                <FloatingInput
                  label="Entry Number"
                  name="entryNumber"
                  value={form.entryNumber || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  label="Entry Date"
                  name="entryDate"
                  type="date"
                  value={form.entryDate || ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  label="Source Module"
                  name="sourceModule"
                  value={form.sourceModule || ""}
                  options={SOURCE_MODULE_OPTIONS}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Source ID"
                  name="sourceId"
                  type="number"
                  value={form.sourceId ?? ""}
                  onChange={handleChange}
                />,
                <FloatingTextarea
                  label="Description"
                  name="description"
                  value={form.description || ""}
                  onChange={handleChange}
                  rows={3}
                />,
              ],
            },
            {
              label: "Entry Lines",
              fields: [
                <React.Fragment key="entry-lines">
                  {entryLines.map((line, idx) => (
                    <div key={idx} className="col-span-full grid grid-cols-4 gap-2 mb-2 items-end">
                      <FloatingSelect
                        label="Account"
                        name={`lineAccount_${idx}`}
                        value={String(line.generalAccountId)}
                        onChange={(e) => {
                          const updated = [...entryLines];
                          updated[idx] = { ...updated[idx], generalAccountId: e.target.value };
                          setEntryLines(updated);
                        }}
                        options={generalAccounts.map((a) => ({ id: String(a.id), name: a.accountName || a.accountCode || `Account ${a.id}` }))}
                      />
                      <FloatingInput label="Debit" name={`lineDebit_${idx}`} type="number" value={line.debit || ""} onChange={(e) => { const updated=[...entryLines]; updated[idx]={...updated[idx],debit:Number(e.target.value)}; setEntryLines(updated); }} />
                      <FloatingInput label="Credit" name={`lineCredit_${idx}`} type="number" value={line.credit || ""} onChange={(e) => { const updated=[...entryLines]; updated[idx]={...updated[idx],credit:Number(e.target.value)}; setEntryLines(updated); }} />
                      <div className="flex gap-1">
                        <div className="flex-1">
                          <FloatingInput label="Narration" name={`lineNarration_${idx}`} value={line.narration} onChange={(e) => { const updated=[...entryLines]; updated[idx]={...updated[idx],narration:e.target.value}; setEntryLines(updated); }} />
                        </div>
                        {entryLines.length > 1 && (
                          <button type="button" onClick={() => setEntryLines(entryLines.filter((_,i) => i !== idx))} className="mb-2 text-red-400 hover:text-red-600"><XMarkIcon className="h-4 w-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="col-span-full">
                    <button type="button" onClick={() => setEntryLines([...entryLines, {generalAccountId:"",debit:0,credit:0,narration:""}])} className="mt-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium">+ Add Line</button>
                  </div>
                </React.Fragment>,
              ],
            },
          ]}
        />

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Journal Entry"
          subText={
            entryToDelete
              ? `Are you sure you want to delete "${entryToDelete.entryNumber}"? This action cannot be undone.`
              : "Are you sure you want to delete this journal entry?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setEntryToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

        <style>{`
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.25s ease-out;
          }
        `}</style>
      </div>
    </>
  );
};

export default JournalEntries;
