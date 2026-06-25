import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

interface Vendor {
  id: number; name: string; contactName: string; contactEmail: string;
  contactPhone: string; address: string; city: string; state: string;
  postalCode: string; country: string; active: boolean;
}

const getStatusColor = (active: boolean) =>
  active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";

const API_URL = "/v1/api/purchase/vendors";

const VendorPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const emptyForm = { name: "", contactName: "", contactEmail: "", contactPhone: "", address: "", city: "", state: "", postalCode: "", country: "", active: true };
  const [form, setForm] = useState<Omit<Vendor, "id">>(emptyForm);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try { const res = await axios.get(API_URL); setVendors(res.data); }
    catch (err) { console.error("Error loading vendors:", err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, form);
      else await axios.post(API_URL, form);
      fetchVendors(); clearForm();
    } catch (err) { console.error("Error saving vendor:", err); }
  };

  const handleEdit = (v: Vendor) => { setEditingId(v.id); setForm(v); setShowForm(true); };
  const promptDelete = (v: Vendor) => { setDeletingVendor(v); setShowDeletePopup(true); };
  const confirmDelete = async () => {
    if (!deletingVendor) return;
    try { await axios.delete(`${API_URL}/${deletingVendor.id}`); fetchVendors(); }
    catch (err) { console.error("Error deleting vendor:", err); }
    setDeletingVendor(null);
  };

  const clearForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };
  const handleChange = (key: keyof Omit<Vendor, "id">, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const stats = {
    total: vendors.length,
    active: vendors.filter(v => v.active).length,
    inactive: vendors.filter(v => !v.active).length,
    countries: new Set(vendors.map(v => v.country).filter(Boolean)).size,
  };

  // Simplified columns with minimal widths
  const columns: ColumnDef<Vendor>[] = [
    {
      key: "name", 
      label: "Name", 
      sortable: true,
      className: "w-[120px] min-w-[120px]",
      render: (_, v) => (
        <div className="flex items-center gap-1">
          <BuildingOfficeIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-900 truncate block max-w-[90px]">
            {String(v)}
          </span>
        </div>
      ),
    },
    {
      key: "contactName", 
      label: "Contact", 
      sortable: true,
      className: "w-[100px] min-w-[100px]",
      render: (_, v) => (
        <div className="flex items-center gap-1">
          <UserIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 truncate block max-w-[80px]">
            {String(v)}
          </span>
        </div>
      ),
    },
    {
      key: "contactEmail", 
      label: "Email", 
      sortable: true,
      className: "w-[130px] min-w-[130px]",
      render: (_, v) => (
        <div className="flex items-center gap-1">
          <EnvelopeIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 truncate block max-w-[100px]">
            {String(v)}
          </span>
        </div>
      ),
    },
    {
      key: "contactPhone", 
      label: "Phone", 
      sortable: true,
      className: "w-[100px] min-w-[100px]",
      render: (_, v) => (
        <div className="flex items-center gap-1">
          <PhoneIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 truncate block max-w-[80px]">
            {String(v)}
          </span>
        </div>
      ),
    },
    {
      key: "city", 
      label: "City", 
      sortable: true,
      className: "w-[100px] min-w-[100px]",
      render: (_, v) => (
        <span className="text-sm text-gray-700 truncate block max-w-[90px]">
          {String(v)}
        </span>
      ),
    },
    {
      key: "country", 
      label: "Country", 
      sortable: true,
      className: "w-[120px] min-w-[120px]",
      render: (_, v) => (
        <span className="text-sm text-gray-700 truncate block max-w-[110px]">
          {String(v)}
        </span>
      ),
    },
    {
      key: "active", 
      label: "Status", 
      sortable: true,
      className: "w-[90px] min-w-[90px]",
      render: (row) => (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(row.active)}`}>
          {row.active ? <><CheckCircleIcon className="h-2.5 w-2.5 mr-0.5 shrink-0" />Active</> : <><XCircleIcon className="h-2.5 w-2.5 mr-0.5 shrink-0" />Inactive</>}
        </span>
      ),
    },
    {
      key: "actions", 
      label: "Actions",
      className: "w-[70px] min-w-[70px] text-right",
      headerClassName: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleEdit(row)} title="Edit"
            className="p-1 rounded-md text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => promptDelete(row)} title="Delete"
            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Vendors" description="Manage your Vendors" />
      <PageBreadcrumb pageTitle="Vendors" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
          
          {/* Header */}
          <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
            {/* <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Vendors</h1>
              <p className="text-xs sm:text-sm text-gray-500">Create and manage vendors</p>
            </div> */}
            <div className="shrink-0">
              <AddButton label="Add Vendor" onClick={() => { clearForm(); setShowForm(true); }} />
            </div>
          </div>

          {/* Stats Cards - Responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard label="Total Vendors" value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
            <StatsCard label="Active" value={stats.active} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
            <StatsCard label="Inactive" value={stats.inactive} gradient="from-red-50 to-pink-50" borderColor="border-red-100" labelColor="text-red-600" />
            <StatsCard label="Countries" value={stats.countries} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
          </div>

          {/* Table with forced horizontal scroll only when needed */}
          <div className="w-full">
            <div className="min-w-full inline-block align-middle">
              <ReusableTable<Vendor>
                data={vendors}
                columns={columns}
                loading={loading}
                searchable
                searchPlaceholder="Search vendor or contact..."
                searchFields={["name", "contactName", "contactEmail", "city", "country"]}
                pageSize={5}
                defaultSortKey="name"
                emptyState={
                  <div className="flex flex-col items-center py-4">
                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <BuildingOfficeIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium mb-2">No vendors found</p>
                    <button onClick={() => { clearForm(); setShowForm(true); }} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                      Add your first vendor →
                    </button>
                  </div>
                }
              />
            </div>
          </div>
      </div>

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Vendor"
        subText={`Are you sure you want to delete "${deletingVendor?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* Vendor Form Popup */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-3 pt-4 pb-20">
            <div className="fixed inset-0 bg-black/50" onClick={clearForm} />
            <div className="relative w-full max-w-[95%] sm:max-w-2xl lg:max-w-3xl bg-white rounded-xl shadow-2xl my-8">
              <div className="flex items-center justify-between px-3 py-3 sm:px-5 sm:py-4 border-b">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                  {editingId ? "Edit Vendor" : "Add New Vendor"}
                </h3>
                <button onClick={clearForm} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 shrink-0 ml-2">
                  <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-3 py-3 sm:px-5 sm:py-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <FloatingInput label="Vendor Name" value={form.name} onChange={e => handleChange("name", e.target.value)} required name="name" />
                  <FloatingInput label="Contact Person" value={form.contactName} onChange={e => handleChange("contactName", e.target.value)} required name="contactName" />
                  <FloatingInput label="Email" type="email" value={form.contactEmail} onChange={e => handleChange("contactEmail", e.target.value)} required name="contactEmail" />
                  <FloatingInput label="Phone" value={form.contactPhone} onChange={e => handleChange("contactPhone", e.target.value)} required name="contactPhone" />
                  <FloatingInput label="Address" value={form.address} onChange={e => handleChange("address", e.target.value)} required name="address" />
                  <FloatingInput label="City" value={form.city} onChange={e => handleChange("city", e.target.value)} required name="city" />
                  <FloatingInput label="State" value={form.state} onChange={e => handleChange("state", e.target.value)} required name="state" />
                  <FloatingInput label="Postal Code" value={form.postalCode} onChange={e => handleChange("postalCode", e.target.value)} required name="postalCode" />
                  <FloatingInput label="Country" value={form.country} onChange={e => handleChange("country", e.target.value)} required name="country" />
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={e => handleChange("active", e.target.checked)}
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                      />
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Active Vendor</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={clearForm}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
                  >
                    {editingId ? "Update Vendor" : "Save Vendor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VendorPage;
