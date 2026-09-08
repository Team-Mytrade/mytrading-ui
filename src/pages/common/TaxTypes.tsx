import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TagIcon,
  GlobeAltIcon,
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
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface TaxType {
  id: number;
  taxName: string;
  taxRate?: number;
  region?: string;
  isActive?: boolean;
  description?: string;
}

const API_URL = "/v1/api/invoice/tax-types";
const PAGE_SIZE = 10;

const REGIONS = ["INDIA", "EU", "USA", "QATAR", "UAE", "CANADA", "AUSTRALIA", "UK", "OTHER"];

const TaxTypes: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [form, setForm] = useState<Partial<TaxType>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [taxTypeToDelete, setTaxTypeToDelete] = useState<TaxType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchTaxTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTaxTypes = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<TaxType[]>(API_URL, { headers });
      setTaxTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching tax types", err);
      ToasterService.error("Failed to load tax types");
      setTaxTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.taxName?.trim()) {
      ToasterService.error("Tax name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(`${API_URL}/create`, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Tax type updated successfully!" : "Tax type added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchTaxTypes();
      }
    } catch (err) {
      console.error("Error submitting tax type", err);
      ToasterService.error("Failed to save tax type");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (taxType: TaxType) => {
    setForm(taxType);
    setEditingId(taxType.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    setForm({ isActive: true });
    setEditingId(null);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
  };

  const handleDelete = (taxType: TaxType) => {
    setTaxTypeToDelete(taxType);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!taxTypeToDelete) return;
    try {
      await axios.delete(`${API_URL}/${taxTypeToDelete.id}`, { headers });
      ToasterService.success("Tax type deleted successfully!");
      setShowDeletePopup(false);
      setTaxTypeToDelete(null);
      fetchTaxTypes();
    } catch (err) {
      console.error("Error deleting tax type", err);
      ToasterService.error("Failed to delete tax type");
    }
  };

  const filteredTaxTypes = useMemo(() => {
    return taxTypes.filter((taxType) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (taxType.taxName || "").toLowerCase().includes(term) ||
        (taxType.description || "").toLowerCase().includes(term) ||
        (taxType.region || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "ACTIVE") {
        matchesFilter = taxType.isActive !== false;
      } else if (activeFilter === "INACTIVE") {
        matchesFilter = taxType.isActive === false;
      }

      return matchesSearch && matchesFilter;
    });
  }, [taxTypes, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: taxTypes.length,
      active: taxTypes.filter((t) => t.isActive !== false).length,
      inactive: taxTypes.filter((t) => t.isActive === false).length,
    }),
    [taxTypes]
  );

  const tableColumns: ColumnDef<TaxType>[] = [
    {
      key: "taxName",
      label: "Tax Name",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (taxType) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <TagIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {taxType.taxName || "Unnamed Tax"}
          </span>
        </div>
      ),
    },
    {
      key: "taxRate",
      label: "Tax Rate",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      sortValueGetter: (taxType) => Number(taxType.taxRate || 0),
      render: (taxType) => (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/40">
          {taxType.taxRate != null ? `${taxType.taxRate}%` : "N/A"}
        </span>
      ),
    },
    {
      key: "region",
      label: "Region",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (taxType) => (
        <span className="inline-flex items-center gap-1 text-sm text-slate-600">
          <GlobeAltIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          {taxType.region || "N/A"}
        </span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (taxType) => (
        <span className="text-sm text-slate-600 truncate" title={taxType.description}>
          {taxType.description || <span className="text-slate-400 italic">No description</span>}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      headerClassName: "w-[5%] text-center",
      className: "w-[5%] text-center",
      render: (taxType) => (
        taxType.isActive !== false ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/40">
            <CheckCircleIcon className="h-3.5 w-3.5" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            Inactive
          </span>
        )
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (taxType) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(taxType)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Tax Type"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(taxType)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Tax Type"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Tax Types" description="Manage tax types" />
      <PageBreadcrumb pageTitle="Tax Types" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Tax Type" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Tax Types"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Active"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Inactive"
            value={stats.inactive}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredTaxTypes.length}
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
                placeholder="Search tax types by name, region, or description..."
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
              title="Filter Tax Types"
              buttonLabel="Filters"
              label="Filter by Status"
              value={activeFilter}
              options={[
                { label: "All Tax Types", value: "ALL" },
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredTaxTypes}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="taxName"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No tax types found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first tax type
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Tax Type" : "Create New Tax Type"}
          subtitle={editingId !== null ? "Update your tax type details" : "Add a new tax type"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Tax Type" : "Create Tax Type"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="taxName"
                  label="Tax Name"
                  name="taxName"
                  value={form.taxName || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="taxRate"
                  label="Tax Rate (%)"
                  name="taxRate"
                  type="number"
                  value={form.taxRate ?? ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  key="region"
                  label="Region"
                  name="region"
                  value={form.region || ""}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  options={REGIONS.map((r) => ({ id: r, name: r }))}
                />,
                <FloatingInput
                  key="description"
                  label="Description"
                  name="description"
                  value={form.description || ""}
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
          innerText="Delete Tax Type"
          subText={
            taxTypeToDelete
              ? `Are you sure you want to delete "${taxTypeToDelete.taxName}"? This action cannot be undone.`
              : "Are you sure you want to delete this tax type?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setTaxTypeToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

      </div>
    </>
  );
};

export default TaxTypes;
