import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";

interface PaymentTerm {
  id: number;
  termCode?: string;
  description?: string;
  dueDays?: number;
}

const API_URL = "/v1/api/invoice/payment-terms";
const PAGE_SIZE = 10;

const PaymentTerms: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [form, setForm] = useState<Partial<PaymentTerm>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [termToDelete, setTermToDelete] = useState<PaymentTerm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchPaymentTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPaymentTerms = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<PaymentTerm[]>(API_URL, { headers });
      setPaymentTerms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching payment terms", err);
      ToasterService.error("Failed to load payment terms");
      setPaymentTerms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.termCode?.trim()) {
      ToasterService.error("Term code is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(API_URL, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Payment term updated successfully!" : "Payment term added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchPaymentTerms();
      }
    } catch (err) {
      console.error("Error submitting payment term", err);
      ToasterService.error("Failed to save payment term");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (term: PaymentTerm) => {
    setForm(term);
    setEditingId(term.id);
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

  const handleDelete = (term: PaymentTerm) => {
    setTermToDelete(term);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!termToDelete) return;
    try {
      await axios.delete(`${API_URL}/${termToDelete.id}`, { headers });
      ToasterService.success("Payment term deleted successfully!");
      setShowDeletePopup(false);
      setTermToDelete(null);
      fetchPaymentTerms();
    } catch (err) {
      console.error("Error deleting payment term", err);
      ToasterService.error("Failed to delete payment term");
    }
  };

  const filteredTerms = useMemo(() => {
    return paymentTerms.filter((term) => {
      const termText = search.toLowerCase();
      return (
        (term.termCode || "").toLowerCase().includes(termText) ||
        (term.description || "").toLowerCase().includes(termText)
      );
    });
  }, [paymentTerms, search]);

  const stats = useMemo(
    () => ({
      total: paymentTerms.length,
      shortTerm: paymentTerms.filter((t) => Number(t.dueDays || 0) <= 30).length,
      longTerm: paymentTerms.filter((t) => Number(t.dueDays || 0) > 30).length,
    }),
    [paymentTerms]
  );

  const tableColumns: ColumnDef<PaymentTerm>[] = [
    {
      key: "termCode",
      label: "Term Code",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (term) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <ClockIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {term.termCode || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[45%] text-left",
      className: "w-[45%]",
      render: (term) => (
        <span className="text-sm text-slate-600 truncate" title={term.description}>
          {term.description || <span className="text-slate-400 italic">No description</span>}
        </span>
      ),
    },
    {
      key: "dueDays",
      label: "Due Days",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      sortValueGetter: (term) => Number(term.dueDays || 0),
      render: (term) => (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/40">
          {term.dueDays != null ? `${term.dueDays} days` : "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[15%] text-right pr-4",
      className: "w-[15%] text-right",
      render: (term) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(term)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Payment Term"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(term)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Payment Term"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Payment Terms" description="Manage payment terms" />
      <PageBreadcrumb pageTitle="Payment Terms" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Payment Term" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Terms"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="<= 30 Days"
            value={stats.shortTerm}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="> 30 Days"
            value={stats.longTerm}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredTerms.length}
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
                placeholder="Search payment terms by code or description..."
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
              title="Filter Payment Terms"
              buttonLabel="Filters"
              label="Filter"
              value={activeFilter}
              options={[
                { label: "All Terms", value: "ALL" },
                { label: "<= 30 Days", value: "SHORT" },
                { label: "> 30 Days", value: "LONG" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredTerms}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="termCode"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No payment terms found</p>
              {search ? (
                <p className="text-gray-400 text-xs">Try adjusting your search</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first payment term
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Payment Term" : "Create New Payment Term"}
          subtitle={editingId !== null ? "Update your payment term" : "Add a new payment term"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Payment Term" : "Create Payment Term"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="termCode"
                  label="Term Code"
                  name="termCode"
                  value={form.termCode || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="description"
                  label="Description"
                  name="description"
                  value={form.description || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="dueDays"
                  label="Due Days"
                  name="dueDays"
                  type="number"
                  value={form.dueDays ?? ""}
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
          innerText="Delete Payment Term"
          subText={
            termToDelete
              ? `Are you sure you want to delete "${termToDelete.termCode}"? This action cannot be undone.`
              : "Are you sure you want to delete this payment term?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setTermToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

      </div>
    </>
  );
};

export default PaymentTerms;
