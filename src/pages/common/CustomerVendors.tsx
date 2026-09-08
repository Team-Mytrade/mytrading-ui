import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  CreditCardIcon,
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
import { FloatingInput, FloatingTextarea } from "../../components/inputfeild/FloatingInput";

interface Vendor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxIdentificationNumber?: string;
  creditLimit?: number;
  active?: boolean;
}

const API_URL = "/v1/api/invoice/vendors";
const PAGE_SIZE = 10;

const Vendors: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<Vendor[]>(API_URL, { headers });
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching vendors", err);
      ToasterService.error("Failed to load vendors");
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      ToasterService.error("Vendor name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(API_URL, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Vendor updated successfully!" : "Vendor added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchVendors();
      }
    } catch (err) {
      console.error("Error submitting vendor", err);
      ToasterService.error("Failed to save vendor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setForm(vendor);
    setEditingId(vendor.id);
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

  const handleDelete = (vendor: Vendor) => {
    setVendorToDelete(vendor);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!vendorToDelete) return;
    try {
      await axios.delete(`${API_URL}/${vendorToDelete.id}`, { headers });
      ToasterService.success("Vendor deleted successfully!");
      setShowDeletePopup(false);
      setVendorToDelete(null);
      fetchVendors();
    } catch (err) {
      console.error("Error deleting vendor", err);
      ToasterService.error("Failed to delete vendor");
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (vendor.name || "").toLowerCase().includes(term) ||
        (vendor.email || "").toLowerCase().includes(term) ||
        (vendor.phone || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "WITH_CREDIT") {
        matchesFilter = Number(vendor.creditLimit || 0) > 0;
      }

      return matchesSearch && matchesFilter;
    });
  }, [vendors, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalVendors: vendors.length,
      withCredit: vendors.filter((v) => Number(v.creditLimit || 0) > 0).length,
      noCredit: vendors.filter((v) => !(Number(v.creditLimit || 0) > 0)).length,
    }),
    [vendors]
  );

  const tableColumns: ColumnDef<Vendor>[] = [
    {
      key: "name",
      label: "Vendor Name",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (vendor) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {vendor.name ? vendor.name.charAt(0).toUpperCase() : "V"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {vendor.name || "Unnamed Vendor"}
          </span>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (vendor) => (
        <span className="text-sm text-slate-600 truncate">{vendor.email || "N/A"}</span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (vendor) => (
        <span className="text-sm text-slate-600 truncate">{vendor.phone || "N/A"}</span>
      ),
    },
    {
      key: "taxIdentificationNumber",
      label: "Tax ID",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (vendor) => (
        <span className="text-sm text-slate-600 truncate">{vendor.taxIdentificationNumber || "N/A"}</span>
      ),
    },
    {
      key: "creditLimit",
      label: "Credit Limit",
      sortable: true,
      headerClassName: "w-[15%] text-right",
      className: "w-[15%] text-right",
      sortValueGetter: (vendor) => Number(vendor.creditLimit || 0),
      render: (vendor) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/40">
          <CreditCardIcon className="h-3.5 w-3.5 text-emerald-600 opacity-80" />
          {Number(vendor.creditLimit || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (vendor) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(vendor)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Vendor"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(vendor)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Vendor"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Vendors" description="Manage invoice vendors" />
      <PageBreadcrumb pageTitle="Vendors" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Vendor" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Vendors"
            value={stats.totalVendors}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="With Credit Limit"
            value={stats.withCredit}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="No Credit Limit"
            value={stats.noCredit}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredVendors.length}
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
                placeholder="Search vendors by name, email, or phone..."
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
              title="Filter Vendors"
              buttonLabel="Filters"
              label="Filter by Credit"
              value={activeFilter}
              options={[
                { label: "All Vendors", value: "ALL" },
                { label: "With Credit Limit", value: "WITH_CREDIT" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredVendors}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="name"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No vendors found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first vendor
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Vendor" : "Create New Vendor"}
          subtitle={editingId !== null ? "Update your vendor details" : "Add a new vendor"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Vendor" : "Create Vendor"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="name"
                  label="Vendor Name"
                  name="name"
                  value={form.name || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="email"
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="phone"
                  label="Phone"
                  name="phone"
                  value={form.phone || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="taxIdentificationNumber"
                  label="Tax Identification Number"
                  name="taxIdentificationNumber"
                  value={form.taxIdentificationNumber || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="creditLimit"
                  label="Credit Limit"
                  name="creditLimit"
                  type="number"
                  value={form.creditLimit ?? ""}
                  onChange={handleChange}
                />,
                <FloatingTextarea
                  key="address"
                  label="Address"
                  name="address"
                  value={form.address || ""}
                  onChange={handleChange}
                  rows={3}
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
          innerText="Delete Vendor"
          subText={
            vendorToDelete
              ? `Are you sure you want to delete "${vendorToDelete.name}"? This action cannot be undone.`
              : "Are you sure you want to delete this vendor?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setVendorToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

      </div>
    </>
  );
};

export default Vendors;
