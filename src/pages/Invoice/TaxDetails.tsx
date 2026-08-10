import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
  CheckCircleIcon,
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

interface TaxDetail {
  id: number;
  taxCode?: string;
  taxDescription?: string;
  taxRate?: number;
  taxAmount?: number;
  taxCatagory?: string;
  taxTypeName?: string;
}

const API_URL = "/v1/api/invoice/tax-details";
const PAGE_SIZE = 10;

const TaxDetails: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [taxDetails, setTaxDetails] = useState<TaxDetail[]>([]);
  const [form, setForm] = useState<Partial<TaxDetail>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [taxDetailToDelete, setTaxDetailToDelete] = useState<TaxDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchTaxDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTaxDetails = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<TaxDetail[]>(API_URL, { headers });
      setTaxDetails(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching tax details", err);
      ToasterService.error("Failed to load tax details");
      setTaxDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.taxCode?.trim()) {
      ToasterService.error("Tax code is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(API_URL, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Tax detail updated successfully!" : "Tax detail added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchTaxDetails();
      }
    } catch (err) {
      console.error("Error submitting tax detail", err);
      ToasterService.error("Failed to save tax detail");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (taxDetail: TaxDetail) => {
    setForm(taxDetail);
    setEditingId(taxDetail.id);
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

  const handleDelete = (taxDetail: TaxDetail) => {
    setTaxDetailToDelete(taxDetail);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!taxDetailToDelete) return;
    try {
      await axios.delete(`${API_URL}/${taxDetailToDelete.id}`, { headers });
      ToasterService.success("Tax detail deleted successfully!");
      setShowDeletePopup(false);
      setTaxDetailToDelete(null);
      fetchTaxDetails();
    } catch (err) {
      console.error("Error deleting tax detail", err);
      ToasterService.error("Failed to delete tax detail");
    }
  };

  const filteredTaxDetails = useMemo(() => {
    return taxDetails.filter((taxDetail) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (taxDetail.taxCode || "").toLowerCase().includes(term) ||
        (taxDetail.taxDescription || "").toLowerCase().includes(term) ||
        (taxDetail.taxCatagory || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "INPUT") {
        matchesFilter = taxDetail.taxCatagory === "INPUT";
      } else if (activeFilter === "OUTPUT") {
        matchesFilter = taxDetail.taxCatagory === "OUTPUT";
      }

      return matchesSearch && matchesFilter;
    });
  }, [taxDetails, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: taxDetails.length,
      input: taxDetails.filter((t) => t.taxCatagory === "INPUT").length,
      output: taxDetails.filter((t) => t.taxCatagory === "OUTPUT").length,
      totalTax: taxDetails.reduce((acc, t) => acc + Number(t.taxAmount || 0), 0),
    }),
    [taxDetails]
  );

  const tableColumns: ColumnDef<TaxDetail>[] = [
    {
      key: "taxCode",
      label: "Tax Code",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (taxDetail) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {taxDetail.taxCode || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "taxDescription",
      label: "Description",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (taxDetail) => (
        <span className="text-sm text-slate-600 truncate" title={taxDetail.taxDescription}>
          {taxDetail.taxDescription || <span className="text-slate-400 italic">No description</span>}
        </span>
      ),
    },
    {
      key: "taxRate",
      label: "Tax Rate",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      sortValueGetter: (taxDetail) => Number(taxDetail.taxRate || 0),
      render: (taxDetail) => (
        <span className="text-sm text-slate-600">{taxDetail.taxRate != null ? `${taxDetail.taxRate}%` : "N/A"}</span>
      ),
    },
    {
      key: "taxAmount",
      label: "Tax Amount",
      sortable: true,
      headerClassName: "w-[15%] text-right",
      className: "w-[15%] text-right",
      sortValueGetter: (taxDetail) => Number(taxDetail.taxAmount || 0),
      render: (taxDetail) => (
        <span className="text-sm font-semibold text-slate-700">
          {Number(taxDetail.taxAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "taxCatagory",
      label: "Category",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (taxDetail) => (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/40">
          {taxDetail.taxCatagory || "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[20%] text-right pr-4",
      className: "w-[20%] text-right",
      render: (taxDetail) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(taxDetail)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Tax Detail"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(taxDetail)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Tax Detail"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Tax Details" description="Manage tax details" />
      <PageBreadcrumb pageTitle="Tax Details" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Tax Detail" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Tax Details"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Input Tax"
            value={stats.input}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Output Tax"
            value={stats.output}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
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
                placeholder="Search tax details by code, description, or category..."
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
              title="Filter Tax Details"
              buttonLabel="Filters"
              label="Filter by Category"
              value={activeFilter}
              options={[
                { label: "All Tax Details", value: "ALL" },
                { label: "Input Tax", value: "INPUT" },
                { label: "Output Tax", value: "OUTPUT" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredTaxDetails}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="taxCode"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No tax details found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first tax detail
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Tax Detail" : "Create New Tax Detail"}
          subtitle={editingId !== null ? "Update your tax detail" : "Add a new tax detail"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Tax Detail" : "Create Tax Detail"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="taxCode"
                  label="Tax Code"
                  name="taxCode"
                  value={form.taxCode || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="taxDescription"
                  label="Tax Description"
                  name="taxDescription"
                  value={form.taxDescription || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="taxRate"
                  label="Tax Rate (%)"
                  name="taxRate"
                  type="number"
                  value={form.taxRate ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="taxAmount"
                  label="Tax Amount"
                  name="taxAmount"
                  type="number"
                  value={form.taxAmount ?? ""}
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
          innerText="Delete Tax Detail"
          subText={
            taxDetailToDelete
              ? `Are you sure you want to delete "${taxDetailToDelete.taxCode}"? This action cannot be undone.`
              : "Are you sure you want to delete this tax detail?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setTaxDetailToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

      </div>
    </>
  );
};

export default TaxDetails;
