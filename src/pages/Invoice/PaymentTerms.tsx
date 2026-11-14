import { useToolbarSearch } from "../../components/common/useToolbarSearch";
import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  ClockIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "./invoiceShared";

import { t } from "../../i18n/i18n";
interface PaymentTerm {
  id: number;
  termCode?: string;
  description?: string;
  dueDays?: number;
}

const API_URL = "/v1/api/invoice/payment-terms";
const PAGE_SIZE = 10;

const PaymentTerms: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();
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
  // The list toolbar's search (beside the stat cards); this page matches it itself
  const search = useToolbarSearch();
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
    const dueDays = Number(form.dueDays);
    if (form.dueDays === undefined || String(form.dueDays) === "" || !Number.isInteger(dueDays) || dueDays < 0) {
      ToasterService.error("Enter the number of days until payment is due");
      return;
    }
    // A blank code becomes NET<days> on the server
    const payload = {
      termCode: form.termCode?.trim() || null,
      description: form.description?.trim() || null,
      dueDays,
    };
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, payload, { headers })
          : await axios.post(API_URL, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Payment term updated successfully!" : "Payment term added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchPaymentTerms();
      }
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to save payment term"));
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
      setShowDeletePopup(false);
      ToasterService.error(apiError(err, "Failed to delete payment term"));
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
          {term.description || <span className="text-slate-400 italic">{t("No description")}</span>}
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
          {canUpdate && (<button
            type="button"
            onClick={() => handleEdit(term)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title={t("Edit Payment Term")}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>)}
          {canDelete && (<button
            type="button"
            onClick={() => handleDelete(term)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title={t("Delete Payment Term")}
          >
            <TrashIcon className="h-4 w-4" />
          </button>)}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Payment Terms")} description="Manage payment terms" />
      <PageBreadcrumb pageTitle="Payment Terms" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {canCreate && <AddButton onClick={openCreate} label={t("Add Payment Term")} />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label={t("Total Terms")}
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label={t("<= 30 Days")}
            value={stats.shortTerm}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label={t("> 30 Days")}
            value={stats.longTerm}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard filterControl={
            <FilterPopover
                  title={t("Filter Payment Terms")}
                  buttonLabel="Filters"
                  label={t("Filter")}
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
          }
            label={t("Filtered")}
            value={filteredTerms.length}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>


        <ReusableTable
          externalSearch
          data={filteredTerms}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="termCode"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">{t("No payment terms found")}</p>
              {search ? (
                <p className="text-gray-400 text-xs">{t("Try adjusting your search")}</p>
              ) : (
                canCreate && <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  {t("Create your first payment term")}
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={t(editingId !== null ? "Edit Payment Term" : "Create New Payment Term")}
          subtitle={t(editingId !== null ? "Update your payment term" : "Add a new payment term")}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={t(editingId !== null ? "Update Payment Term" : "Create Payment Term")}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="termCode"
                  label={t("Term code (blank = NET + days)")}
                  name="termCode"
                  value={form.termCode || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="description"
                  label={t("Description")}
                  name="description"
                  value={form.description || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="dueDays"
                  label={t("Due in (days)")}
                  name="dueDays"
                  type="number"
                  min={0}
                  step={1}
                  value={form.dueDays ?? ""}
                  // Whole days, 0 or more: a minus sign or decimal point can't be typed
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setForm({ ...form, dueDays: e.target.value === "" ? undefined : (e.target.value.replace(/\D/g, "") as unknown as number) })
                  }
                  required
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
          innerText={t("Delete Payment Term")}
          subText={
            termToDelete
              ? `Are you sure you want to delete "${termToDelete.termCode}"? This action cannot be undone.`
              : "Are you sure you want to delete this payment term?"
          }
          confirmLabel={t("Delete")}
          cancelLabel={t("Cancel")}
          onConfirm={confirmDelete}
          onCancel={() => setTermToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

      </div>
    </>
  );
};

export default PaymentTerms;
