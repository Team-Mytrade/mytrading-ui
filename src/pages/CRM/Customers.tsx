import React, { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  LinkIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  CheckIcon,
  FunnelIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, Link } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";

// Enums
enum CustomerStatus {
  LEAD = "LEAD",
  ACTIVE = "ACTIVE",
  CREDIT_HOLD = "CREDIT_HOLD",
  BLOCKED = "BLOCKED",
  INACTIVE = "INACTIVE",
}

interface Address {
  type: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  defaultAddress: boolean;
}

interface Customer {
  id: number;
  customerName: string;
  tradeName?: string;
  taxNumber?: string;
  registrationNumber?: string;
  customerType: string;
  status: CustomerStatus;
  phone: string;
  email: string;
  website?: string;
  creditLimit?: number;
  currentCredit?: number;
  outstandingBalance?: number;
  paymentTerms?: string;
  currencyCode?: string;
  active: boolean;
  addresses: Address[];
  segments?: any[];
}

interface Segment {
  id: number;
  name: string;
}

const API_URL = "/v1/api/crm/customers";
const PAGE_SIZE = 10;

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const [commForm, setCommForm] = useState({
    type: "EMAIL",
    subject: "",
    notes: "",
    communicationTime: new Date().toISOString().split('T')[0],
  });

  // Fetch customers
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Customer[]>(API_URL);
      setCustomers(res.data);
      setFilteredCustomers(res.data);
    } catch (err) {
      console.error("Error fetching customers", err);
      ToasterService.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Search filter
  useEffect(() => {
    const term = search.toLowerCase();
    const result = customers.filter((c) => {
      const matchesSearch =
        c.customerName?.toLowerCase().includes(term) ||
        c.tradeName?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "ACTIVE") {
        matchesFilter = c.status === CustomerStatus.ACTIVE;
      } else if (activeFilter === "INACTIVE") {
        matchesFilter = c.status === CustomerStatus.INACTIVE;
      } else if (activeFilter === "LEAD") {
        matchesFilter = c.status === CustomerStatus.LEAD;
      }

      return matchesSearch && matchesFilter;
    });

    setFilteredCustomers(result);
  }, [search, customers, activeFilter]);

  // Navigation to create new customer
  const handleAddCustomer = () => {
    navigate("/customers/new");
  };

  // Navigation to edit customer
  const handleEditCustomer = (customer: Customer) => {
    navigate(`/customers/edit/${customer.id}`);
  };

  // Navigation to view customer
  const handleViewCustomer = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer?.id) return;
    try {
      await axios.delete(`${API_URL}/${selectedCustomer.id}`);
      ToasterService.success("Customer deleted successfully!");
      setShowDeleteModal(false);
      fetchCustomers();
    } catch (err: any) {
      console.error("Error deleting customer:", err);
      ToasterService.error(err.response?.data?.message || "Failed to delete customer!");
    }
  };

  // Segment handlers
  const openSegmentModal = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const res = await axios.get("/v1/api/crm/segments");
      setSegments(res.data);
      setShowSegmentModal(true);
    } catch (err) {
      console.error("Error fetching segments:", err);
      ToasterService.error("Failed to load segments");
    }
  };

  const handleAssignSegment = async (segmentId: number) => {
    if (!selectedCustomer?.id) return;
    try {
      await axios.post(`/v1/api/crm/segments/${segmentId}/assign/${selectedCustomer.id}`);
      ToasterService.success("Customer assigned to segment successfully!");
      setShowSegmentModal(false);
      fetchCustomers();
    } catch (err) {
      console.error("Error assigning segment:", err);
      ToasterService.error("Failed to assign segment");
    }
  };

  // Communication handlers
  const openCommModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCommForm({
      type: "EMAIL",
      subject: "",
      notes: "",
      communicationTime: new Date().toISOString().split('T')[0],
    });
    setShowCommModal(true);
  };

  const handleSubmitComm = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer?.id) return;

    try {
      const payload = {
        ...commForm,
        customer: { id: selectedCustomer.id },
      };
      await axios.post("/v1/api/crm/communications", payload);
      ToasterService.success("Communication recorded successfully!");
      setShowCommModal(false);
    } catch (err) {
      console.error("Error saving communication:", err);
      ToasterService.error("Failed to record communication");
    }
  };

  // Get address count
  const getAddressCount = (customer: Customer) => {
    return customer.addresses?.length || 0;
  };

  const toNumberOrZero = (value: unknown) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };

  const buildCustomerPayload = (customer: Customer, status = customer.status) => ({
    customerName: customer.customerName,
    tradeName: customer.tradeName,
    taxNumber: customer.taxNumber,
    registrationNumber: customer.registrationNumber,
    customerType: customer.customerType,
    status,
    phone: customer.phone,
    email: customer.email,
    website: customer.website,
    creditLimit: toNumberOrZero(customer.creditLimit),
    currentCredit: toNumberOrZero(customer.currentCredit),
    outstandingBalance: toNumberOrZero(customer.outstandingBalance),
    paymentTerms: customer.paymentTerms,
    currencyCode: customer.currencyCode,
    active: status === CustomerStatus.ACTIVE,
    addresses: customer.addresses || [],
  });

  const handleStatusChange = async (customer: Customer, status: CustomerStatus) => {
    if (customer.status === status) return;

    const previousCustomers = customers;
    const nextCustomers = customers.map((item) =>
      item.id === customer.id ? { ...item, status, active: status === CustomerStatus.ACTIVE } : item
    );
    setCustomers(nextCustomers);
    setFilteredCustomers((current) =>
      current.map((item) =>
        item.id === customer.id ? { ...item, status, active: status === CustomerStatus.ACTIVE } : item
      )
    );

    try {
      setStatusUpdatingId(customer.id);
      await axios.put(`${API_URL}/${customer.id}`, buildCustomerPayload(customer, status));
      ToasterService.success("Customer status updated successfully!");
    } catch (err: any) {
      console.error("Error updating customer status:", err);
      setCustomers(previousCustomers);
      ToasterService.error(err.response?.data?.message || "Failed to update customer status!");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const tableColumns: ColumnDef<Customer>[] = [
    {
      key: "customerName",
      label: "Company",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (customer) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {customer.customerName?.charAt(0).toUpperCase() || "C"}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
              {customer.customerName}
            </span>
            {customer.tradeName && (
              <span className="text-xs text-slate-400 truncate">Trade: {customer.tradeName}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (customer) => (
        <div className="flex items-center text-sm text-slate-600 gap-1.5 min-w-0">
          <EnvelopeIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate max-w-[140px] font-medium text-slate-600" title={customer.email}>
            {customer.email || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (customer) => (
        <div className="flex items-center text-sm text-slate-600 gap-1.5 min-w-0">
          <PhoneIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate font-medium text-slate-600">{customer.phone || "—"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (customer) => {
        const statusColors = {
          [CustomerStatus.ACTIVE]: "border-green-200 bg-green-50 text-green-700",
          [CustomerStatus.LEAD]: "border-blue-200 bg-blue-50 text-blue-700",
          [CustomerStatus.CREDIT_HOLD]: "border-yellow-200 bg-yellow-50 text-yellow-700",
          [CustomerStatus.BLOCKED]: "border-red-200 bg-red-50 text-red-700",
          [CustomerStatus.INACTIVE]: "border-red-200 bg-red-50 text-red-700",
        };
        return (
          <div onClick={(event) => event.stopPropagation()}>
            <select
              value={customer.status}
              onChange={(event) => handleStatusChange(customer, event.target.value as CustomerStatus)}
              disabled={statusUpdatingId === customer.id}
              className={`w-[116px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${
                statusColors[customer.status]
              } ${statusUpdatingId === customer.id ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <option value={CustomerStatus.LEAD}>Lead</option>
              <option value={CustomerStatus.ACTIVE}>Active</option>
              <option value={CustomerStatus.CREDIT_HOLD}>Credit Hold</option>
              <option value={CustomerStatus.BLOCKED}>Blocked</option>
              <option value={CustomerStatus.INACTIVE}>Inactive</option>
            </select>
          </div>
        );
      },
    },
    {
      key: "addresses",
      label: "Addresses",
      sortable: false,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (customer) => (
        <div className="flex items-center gap-1">
          <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-sm text-slate-600">
            {getAddressCount(customer)} address{getAddressCount(customer) !== 1 ? "es" : ""}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] md:w-[15%] lg:w-[12%] text-right pr-4",
       className: "w-[10%] text-right",
      render: (customer) => (
        <div className="flex items-center md:ml-auto ml-32 justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleViewCustomer(customer)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
            title="View Customer"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleEditCustomer(customer)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Customer"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => openCommModal(customer)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
            title="Add Communication"
          >
            <LinkIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => openSegmentModal(customer)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600"
            title="Add to Segment"
          >
            <UsersIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCustomer(customer);
              setShowDeleteModal(true);
            }}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Customer"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Customers" description="Manage your Customers" />
      <PageBreadcrumb pageTitle="Customers" />

      <div className="min-w-0 w-full max-w-full px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={handleAddCustomer} label="Add Customer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Customers"
            value={customers.length}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Active"
            value={customers.filter((c) => c.status === CustomerStatus.ACTIVE).length}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Leads"
            value={customers.filter((c) => c.status === CustomerStatus.LEAD).length}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard
            label="Credit Hold"
            value={customers.filter((c) => c.status === CustomerStatus.CREDIT_HOLD).length}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md md:-mt-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers by name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="relative flex w-full items-center justify-end gap-3 sm:w-auto">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-lg border px-3 py-2 flex items-center gap-2 transition-colors h-[40px] ${showFilters ? "bg-cyan-50 border-cyan-300 text-cyan-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
              <span className="text-sm font-medium">Filters</span>
            </button>
                               

            {showFilters && (
              <div className="absolute right-0 top-[48px] z-30 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Filter Customers</h4>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>

                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="ALL">All Customers</option>
                  <option value="ACTIVE">Active</option>
                  <option value="LEAD">Leads</option>
                  <option value="INACTIVE">Inactive</option>
                </select>

                <div className="mt-4 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("ALL");
                      setShowFilters(false);
                    }}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <ReusableTable
          data={filteredCustomers}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="customerName"
          defaultSortOrder="asc"
          onRowClick={handleViewCustomer}
          loading={loading}
          className="max-w-full"
          emptyState={
            <div className="flex flex-col items-center">
              <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No customers found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={handleAddCustomer}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first customer
                </button>
              )}
            </div>
          }
        />

        {/* Segment Modal */}
        {showSegmentModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Add to Segment</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Select a segment for {selectedCustomer?.customerName}</p>
                </div>
                <button onClick={() => setShowSegmentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5">
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {segments.length > 0 ? (
                    segments.map((segment) => (
                      <button
                        key={segment.id}
                        onClick={() => handleAssignSegment(segment.id)}
                        className="w-full text-left px-4 py-3 rounded-lg border border-gray-100 hover:border-cyan-500 hover:bg-cyan-50 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-cyan-700">{segment.name}</span>
                          <PlusIcon className="h-4 w-4 text-gray-300 group-hover:text-cyan-500" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No segments available</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowSegmentModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Communication Modal */}
        {showCommModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Record Communication</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Add communication history for {selectedCustomer?.customerName}</p>
                </div>
                <button onClick={() => setShowCommModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmitComm} className="p-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <select
                    value={commForm.type}
                    onChange={(e) => setCommForm({ ...commForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="EMAIL">Email</option>
                    <option value="CALL">Call</option>
                    <option value="MEETING">Meeting</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    type="date"
                    value={commForm.communicationTime}
                    onChange={(e) => setCommForm({ ...commForm, communicationTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>
                <input
                  type="text"
                  placeholder="Subject"
                  value={commForm.subject}
                  onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  required
                />
                <textarea
                  placeholder="Notes"
                  value={commForm.notes}
                  onChange={(e) => setCommForm({ ...commForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
                <div className="flex flex-col justify-end gap-2 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowCommModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 shadow-sm flex items-center gap-2"
                  >
                    <CheckIcon className="h-4 w-4" />
                    Save Communication
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        <DynamicPopup
          isPopupOpen={showDeleteModal}
          setIsPopupOpen={setShowDeleteModal}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Customer?"
          subText={
            selectedCustomer
              ? `Are you sure you want to delete ${selectedCustomer.customerName}? This action cannot be undone and will remove all associated data.`
              : "Are you sure you want to delete this customer?"
          }
          confirmLabel="Delete Customer"
          cancelLabel="Cancel"
          onConfirm={handleDeleteCustomer}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        tr { animation: fade-in 0.25s ease-out; cursor: pointer; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
};

// Eye Icon component (if not already imported)
const EyeIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export default Customers;
