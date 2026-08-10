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
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface GeneralLedger {
  id: number;
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  sourceModule?: string;
  sourceId?: number;
}

const API_URL = "/v1/api/invoice/general-ledger";
const PAGE_SIZE = 10;

const SOURCE_MODULES = ["SALES_INVOICE", "PURCHASE_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "ADJUSTMENT_NOTE", "OTHER"];

const sourceModuleTone = (module?: string) => {
  switch (module) {
    case "SALES_INVOICE":
      return "bg-cyan-50 text-cyan-700 border-cyan-200/40";
    case "PURCHASE_INVOICE":
      return "bg-blue-50 text-blue-700 border-blue-200/40";
    case "CREDIT_NOTE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/40";
    case "DEBIT_NOTE":
      return "bg-red-50 text-red-700 border-red-200/40";
    case "ADJUSTMENT_NOTE":
      return "bg-yellow-50 text-yellow-700 border-yellow-200/40";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200/40";
  }
};

const GeneralLedger: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [ledgerEntries, setLedgerEntries] = useState<GeneralLedger[]>([]);
  const [form, setForm] = useState<Partial<GeneralLedger>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<GeneralLedger | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [generalAccounts, setGeneralAccounts] = useState<{id:number;accountName?:string;accountCode?:string}[]>([]);
  const [entryLines, setEntryLines] = useState<{generalAccountId:number|string;debit:number;credit:number;narration:string}[]>([{generalAccountId:"",debit:0,credit:0,narration:""}]);

  useEffect(() => {
    fetchLedgerEntries();
    axios.get("/v1/api/invoice/general-accounts", { headers }).then(r => setGeneralAccounts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLedgerEntries = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<GeneralLedger[]>(API_URL, { headers });
      setLedgerEntries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching general ledger entries", err);
      ToasterService.error("Failed to load general ledger entries");
      setLedgerEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
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
        ToasterService.success(editingId !== null ? "Ledger entry updated successfully!" : "Ledger entry added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchLedgerEntries();
      }
    } catch (err: any) {
      console.error("Error submitting ledger entry", err);
      ToasterService.error(err?.response?.data?.error || "Failed to save ledger entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: GeneralLedger) => {
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

  const handleDelete = (entry: GeneralLedger) => {
    setEntryToDelete(entry);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await axios.delete(`${API_URL}/${entryToDelete.id}`, { headers });
      ToasterService.success("Ledger entry deleted successfully!");
      setShowDeletePopup(false);
      setEntryToDelete(null);
      fetchLedgerEntries();
    } catch (err) {
      console.error("Error deleting ledger entry", err);
      ToasterService.error("Failed to delete ledger entry");
    }
  };

  const filteredLedgerEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => {
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
  }, [ledgerEntries, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalEntries: ledgerEntries.length,
      invoiceEntries: ledgerEntries.filter(
        (e) => e.sourceModule === "SALES_INVOICE" || e.sourceModule === "PURCHASE_INVOICE"
      ).length,
    }),
    [ledgerEntries]
  );

  const tableColumns: ColumnDef<GeneralLedger>[] = [
    {
      key: "entryNumber",
      label: "Entry Number",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (entry) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {entry.entryNumber || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "entryDate",
      label: "Entry Date",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (entry) => (
        <span className="text-sm text-slate-600">
          {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[24%] text-left",
      className: "w-[24%]",
      render: (entry) => (
        <span className="text-sm text-slate-600 truncate">{entry.description || "N/A"}</span>
      ),
    },
    {
      key: "sourceModule",
      label: "Source Module",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (entry) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${sourceModuleTone(entry.sourceModule)}`}>
          {entry.sourceModule || "N/A"}
        </span>
      ),
    },
    {
      key: "sourceId",
      label: "Source ID",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (entry) => (
        <span className="text-sm text-slate-600 truncate">{entry.sourceId || "N/A"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[14%] text-right pr-4",
      className: "w-[14%] text-right",
      render: (entry) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(entry)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Entry"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(entry)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Entry"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="General Ledger" description="Manage general ledger entries" />
      <PageBreadcrumb pageTitle="General Ledger" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Ledger Entry" />
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
            label="Invoice Entries"
            value={stats.invoiceEntries}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredLedgerEntries.length}
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
                placeholder="Search entries by number, description, or module..."
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
              title="Filter General Ledger"
              buttonLabel="Filters"
              label="Filter by Source Module"
              value={activeFilter}
              options={[
                { label: "All Entries", value: "ALL" },
                { label: "Sales Invoices", value: "SALES_INVOICE" },
                { label: "Purchase Invoices", value: "PURCHASE_INVOICE" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredLedgerEntries}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="entryNumber"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No ledger entries found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first ledger entry
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Ledger Entry" : "Create New Ledger Entry"}
          subtitle={editingId !== null ? "Update your ledger entry details" : "Add a new ledger entry"}
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
                  key="entryNumber"
                  label="Entry Number"
                  name="entryNumber"
                  value={form.entryNumber || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="entryDate"
                  label="Entry Date"
                  name="entryDate"
                  type="date"
                  value={form.entryDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="description"
                  label="Description"
                  name="description"
                  value={form.description || ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  key="sourceModule"
                  label="Source Module"
                  name="sourceModule"
                  value={form.sourceModule || ""}
                  onChange={(e) => setForm({ ...form, sourceModule: e.target.value })}
                  options={SOURCE_MODULES.map((s) => ({ id: s, name: s }))}
                />,
                <FloatingInput
                  key="sourceId"
                  label="Source ID"
                  name="sourceId"
                  type="number"
                  value={form.sourceId ?? ""}
                  onChange={handleChange}
                />,
              ],
            },
            {
              label: "Entry Lines",
              fields: [
                <div key="entry-lines-wrapper" className="col-span-2">
                  {entryLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-end">
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
                  <button type="button" onClick={() => setEntryLines([...entryLines, {generalAccountId:"",debit:0,credit:0,narration:""}])} className="mt-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium">+ Add Line</button>
                </div>
              ],
            },
          ]}
        />

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Ledger Entry"
          subText={
            entryToDelete
              ? `Are you sure you want to delete "${entryToDelete.entryNumber}"? This action cannot be undone.`
              : "Are you sure you want to delete this ledger entry?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setEntryToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />


      </div>
    </>
  );
};

export default GeneralLedger;
