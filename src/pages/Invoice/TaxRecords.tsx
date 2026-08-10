import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CreditCardIcon,
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

interface TaxRecord {
  id: number;
  transactionType?: string;
  sourceId?: number;
  sourceModule?: string;
  taxableAmount?: number;
  taxAmount?: number;
  transactionDate?: string;
  taxTypeName?: string;
  taxTypeId?: number;
}

const API_URL = "/v1/api/invoice/tax-record";
const PAGE_SIZE = 10;

const TRANSACTION_TONES: Record<string, string> = {
  SALE: "bg-green-50 text-green-700 border-green-200/40",
  PURCHASE: "bg-blue-50 text-blue-700 border-blue-200/40",
  OTHER: "bg-gray-100 text-gray-600 border-gray-200",
};

const TaxRecords: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([]);
  const [form, setForm] = useState<Partial<TaxRecord>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TaxRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [taxTypes, setTaxTypes] = useState<{id:number;taxName?:string}[]>([]);

  useEffect(() => {
    fetchTaxRecords();
    axios.get("/v1/api/invoice/tax-types", { headers }).then(r => setTaxTypes(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTaxRecords = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/report`, { headers });
      setTaxRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching tax records", err);
      ToasterService.error("Failed to load tax records");
      setTaxRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.sourceModule?.trim()) {
      ToasterService.error("Source module is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        sourceModule: form.sourceModule,
        transactionType: form.transactionType,
        taxableAmount: form.taxableAmount ? Number(form.taxableAmount) : undefined,
        transactionDate: form.transactionDate,
      };
      if (form.taxTypeId) payload.taxTypeId = Number(form.taxTypeId);
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/record/${editingId}`, payload, { headers })
          : await axios.post(`${API_URL}/record`, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Tax record updated successfully!" : "Tax record added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchTaxRecords();
      }
    } catch (err) {
      console.error("Error submitting tax record", err);
      ToasterService.error("Failed to save tax record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record: TaxRecord) => {
    setForm(record);
    setEditingId(record.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    setForm({});
    setEditingId(null);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
  };

  const handleDelete = (record: TaxRecord) => {
    setRecordToDelete(record);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await axios.delete(`${API_URL}/record/${recordToDelete.id}`, { headers });
      ToasterService.success("Tax record deleted successfully!");
      setShowDeletePopup(false);
      setRecordToDelete(null);
      fetchTaxRecords();
    } catch (err) {
      console.error("Error deleting tax record", err);
      ToasterService.error("Failed to delete tax record");
    }
  };

  const filteredTaxRecords = useMemo(() => {
    return taxRecords.filter((record) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (record.sourceModule || "").toLowerCase().includes(term) ||
        (record.transactionType || "").toLowerCase().includes(term) ||
        (record.taxTypeName || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter !== "ALL") {
        matchesFilter = (record.transactionType || "") === activeFilter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [taxRecords, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: taxRecords.length,
      sales: taxRecords.filter((t) => t.transactionType === "SALE").length,
      purchases: taxRecords.filter((t) => t.transactionType === "PURCHASE").length,
      totalTax: taxRecords.reduce((sum, t) => sum + Number(t.taxAmount || 0), 0),
    }),
    [taxRecords]
  );

  const tableColumns: ColumnDef<TaxRecord>[] = [
    {
      key: "transactionType",
      label: "Transaction Type",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (record) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
            TRANSACTION_TONES[record.transactionType || ""] || "bg-gray-100 text-gray-600 border-gray-200"
          }`}
        >
          {record.transactionType || "N/A"}
        </span>
      ),
    },
    {
      key: "sourceModule",
      label: "Source Module",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (record) => (
        <span className="text-sm font-semibold text-slate-900 truncate">{record.sourceModule || "N/A"}</span>
      ),
    },
    {
      key: "sourceId",
      label: "Source ID",
      sortable: true,
      headerClassName: "w-[9%] text-left",
      className: "w-[9%]",
      sortValueGetter: (record) => Number(record.sourceId || 0),
      render: (record) => (
        <span className="text-sm text-slate-600">{record.sourceId ?? "N/A"}</span>
      ),
    },
    {
      key: "taxableAmount",
      label: "Taxable Amount",
      sortable: true,
      headerClassName: "w-[13%] text-right",
      className: "w-[13%] text-right",
      sortValueGetter: (record) => Number(record.taxableAmount || 0),
      render: (record) => (
        <span className="text-sm text-slate-600">{Number(record.taxableAmount || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "taxAmount",
      label: "Tax Amount",
      sortable: true,
      headerClassName: "w-[13%] text-right",
      className: "w-[13%] text-right",
      sortValueGetter: (record) => Number(record.taxAmount || 0),
      render: (record) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          <CreditCardIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {Number(record.taxAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "transactionDate",
      label: "Transaction Date",
      sortable: true,
      headerClassName: "w-[23%] text-left",
      className: "w-[23%]",
      render: (record) => (
        <span className="text-sm text-slate-600 truncate">{record.transactionDate || "N/A"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (record) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(record)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Record"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(record)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Record"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Tax Records" description="Manage tax records" />
      <PageBreadcrumb pageTitle="Tax Records" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Tax Record" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Records"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Sales Records"
            value={stats.sales}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Purchase Records"
            value={stats.purchases}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard
            label="Total Tax Amount"
            value={stats.totalTax.toLocaleString()}
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
                placeholder="Search by source module, type, or tax type..."
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
              title="Filter Tax Records"
              buttonLabel="Filters"
              label="Filter by Type"
              value={activeFilter}
              options={[
                { label: "All Records", value: "ALL" },
                { label: "Sale", value: "SALE" },
                { label: "Purchase", value: "PURCHASE" },
                { label: "Other", value: "OTHER" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredTaxRecords}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="sourceModule"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CreditCardIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No tax records found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first tax record
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Tax Record" : "Create New Tax Record"}
          subtitle={editingId !== null ? "Update your tax record details" : "Add a new tax record"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Record" : "Create Record"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingSelect
                  key="sourceModule"
                  label="Source Module"
                  name="sourceModule"
                  value={form.sourceModule || ""}
                  onChange={(e) => setForm({ ...form, sourceModule: e.target.value })}
                  options={["SALES_INVOICE", "PURCHASE_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "ADJUSTMENT_NOTE", "OTHER"].map((m) => ({ id: m, name: m }))}
                  required
                />,
                <FloatingSelect
                  key="taxTypeId"
                  label="Tax Type"
                  name="taxTypeId"
                  value={form.taxTypeId ?? ""}
                  onChange={(e) => setForm({ ...form, taxTypeId: e.target.value ? Number(e.target.value) : undefined })}
                  options={taxTypes.map((t) => ({ id: String(t.id), name: t.taxName || `Tax ${t.id}` }))}
                  required
                />,
                <FloatingSelect
                  key="transactionType"
                  label="Transaction Type"
                  name="transactionType"
                  value={form.transactionType || ""}
                  onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
                  options={["SALE", "PURCHASE", "OTHER"].map((t) => ({ id: t, name: t }))}
                />,
                <FloatingInput
                  key="taxableAmount"
                  label="Taxable Amount"
                  name="taxableAmount"
                  type="number"
                  value={form.taxableAmount ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="transactionDate"
                  label="Transaction Date"
                  name="transactionDate"
                  type="date"
                  value={form.transactionDate || ""}
                  onChange={handleChange}
                />,
              ],
            },
          ]}
        />

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Tax Record"
          subText={
            recordToDelete
              ? `Are you sure you want to delete the tax record for "${recordToDelete.sourceModule || "this record"}"? This action cannot be undone.`
              : "Are you sure you want to delete this tax record?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setRecordToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />


      </div>
    </>
  );
};

export default TaxRecords;
