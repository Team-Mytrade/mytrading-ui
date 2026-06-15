import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  MapPinIcon,
  HashtagIcon,
  UserIcon,
  PhoneIcon,
  StarIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliveryAddress {
  id?: number;
  customerName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/dispatch/delivery-addresses";

const emptyForm: DeliveryAddress = {
  customerName: "",
  addressLine1: "",
  addressLine2: "",
  city:         "",
  state:        "",
  postalCode:   "",
  country:      "",
  phone:        "",
  isDefault:    false,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const DeliveryAddressPage: React.FC = () => {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<DeliveryAddress>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<DeliveryAddress | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<DeliveryAddress[]>(API_URL);
      setAddresses(res.data);
    } catch (err) {
      console.error("Failed to load delivery addresses:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof DeliveryAddress, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleEdit = (address: DeliveryAddress) => {
    setForm({ ...address, addressLine2: address.addressLine2 ?? "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, addressLine2: form.addressLine2 || undefined };
    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload);
      } else {
        await axios.post(API_URL, payload);
      }
      loadData();
      resetForm();
    } catch (err) {
      console.error("Error saving address:", err);
    }
  };

  const promptDelete = (address: DeliveryAddress) => {
    setDeletingItem(address);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await axios.delete(`${API_URL}/${deletingItem.id}`);
      loadData();
    } catch (err) {
      console.error("Error deleting address:", err);
    }
    setDeletingItem(null);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total:      addresses.length,
    defaults:   addresses.filter(a => a.isDefault).length,
    cities:     new Set(addresses.map(a => a.city).filter(Boolean)).size,
    countries:  new Set(addresses.map(a => a.country).filter(Boolean)).size,
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<DeliveryAddress>[] = [
    {
      key: "id",
      label: "ID",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "addressLine1",
      label: "Address",
      render: (row) => (
        <div className="flex items-start gap-2">
          <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          <span className="text-sm text-gray-600 leading-snug">
            {row.addressLine1}
            {row.addressLine2 ? `, ${row.addressLine2}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "city",
      label: "City",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "state",
      label: "State",
      sortable: true,
      render: (_, v) => (
        <span className="text-sm text-gray-600">{String(v)}</span>
      ),
    },
    {
      key: "postalCode",
      label: "Postal Code",
      render: (_, v) => (
        <span className="text-sm font-mono text-gray-700">{String(v)}</span>
      ),
    },
    {
      key: "country",
      label: "Country",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <PhoneIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "isDefault",
      label: "Default",
      sortable: true,
      render: (_, v) =>
        v ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <StarSolid className="h-3 w-3" />
            Default
          </span>
        ) : (
          <span className="text-gray-300">
            <StarIcon className="h-4 w-4" />
          </span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleEdit(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => promptDelete(row)}
            title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageMeta
        title="Customer Delivery Addresses"
        description="Manage customer delivery addresses"
      />
      <PageBreadcrumb pageTitle="Customer Delivery Addresses" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end ">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Delivery Addresses</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage customer delivery and shipping addresses
            </p>
          </div> */}
          <AddButton
            label="Add Address"
            onClick={() => { setForm(emptyForm); setShowForm(true); }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard
            label="Total Addresses"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Default Addresses"
            value={stats.defaults}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard
            label="Unique Cities"
            value={stats.cities}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Countries"
            value={stats.countries}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? "Edit Address" : "Add New Address"}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={e => handleChange("customerName", e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => handleChange("phone", e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.addressLine1}
                    onChange={e => handleChange("addressLine1", e.target.value)}
                    placeholder="Street address, building, flat no."
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.addressLine2}
                    onChange={e => handleChange("addressLine2", e.target.value)}
                    placeholder="Landmark, area, locality"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => handleChange("city", e.target.value)}
                    placeholder="e.g. Chennai"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={e => handleChange("state", e.target.value)}
                    placeholder="e.g. Tamil Nadu"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Postal Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={e => handleChange("postalCode", e.target.value)}
                    placeholder="e.g. 600001"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={e => handleChange("country", e.target.value)}
                    placeholder="e.g. India"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Default checkbox */}
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={e => handleChange("isDefault", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Set as default address
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
                >
                  {form.id ? "Update Address" : "Add Address"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <ReusableTable<DeliveryAddress>
          data={addresses}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by customer, city, state, or postal code..."
          searchFields={["customerName", "city", "state", "postalCode", "country", "phone"]}
          pageSize={5}
          defaultSortKey="customerName"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <MapPinIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">
                No delivery addresses found
              </p>
              <button
                onClick={() => { setForm(emptyForm); setShowForm(true); }}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
              >
                Add your first address →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Address"
        subText="Are you sure you want to delete this delivery address? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default DeliveryAddressPage;
