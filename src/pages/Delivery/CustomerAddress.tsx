import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useParams, useNavigate } from "react-router-dom";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";

import { 
  MagnifyingGlassIcon, 
  MapPinIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserIcon,
  HomeIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  XMarkIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/solid";
import { 
  FunnelIcon,
  TrashIcon,
  CheckIcon
} from "lucide-react";

// ================= TYPES =================

// Match the Customer interface from CustomerManager
interface Customer {
  id: number;
  customerName: string;
  tradeName?: string;
  taxNumber?: string;
  registrationNumber?: string;
  customerType: string;
  status: string;
  phone: string;
  email: string;
  website?: string;
  creditLimit?: number;
  currentCredit?: number;
  paymentTerms?: string;
  currencyCode?: string;
  active: boolean;
  addresses: Address[];
  segments?: any[];
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

interface CustomerAddress {
  id: number;
  customerId: number;
  customerNumber: string;
  customerName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  landmark?: string;
  active: boolean;
  defaultDelivery: boolean;
  defaultBilling: boolean;
  type?: string;
}

// ================= API CONFIGURATION =================

const API_BASE_URL = "/v1/api/delivery/customer-addresses";
const CRM_API_BASE_URL = "/v1/api/crm/customers";

const API = {
  // Address endpoints
  getAll: (customerId: number) => `${API_BASE_URL}/by-customer/${customerId}`,
  getById: (id: number) => `${API_BASE_URL}/${id}`,
  create: API_BASE_URL,
  update: (id: number) => `${API_BASE_URL}/${id}`,
  delete: (id: number) => `${API_BASE_URL}/${id}`,
  
  // Customer endpoints (from CRM)
  getCustomerById: (id: number) => `${CRM_API_BASE_URL}/${id}`,
};

// ================= HELPER FUNCTIONS =================

// Get customer number from CRM data or generate one
const getCustomerNumber = (customer: Customer): string => {
  // Priority 1: Use taxNumber if available
  if (customer.taxNumber) {
    return customer.taxNumber;
  }
  
  // Priority 2: Use registrationNumber if available
  if (customer.registrationNumber) {
    return customer.registrationNumber;
  }
  
  // Priority 3: Generate from customer name and ID
  const prefix = customer.customerName?.substring(0, 3).toUpperCase() || 'CUST';
  return `${prefix}-${customer.id}`;
};

// ================= CONSTANTS =================

const PAGE_SIZE = 10;

// ================= COMPONENT =================

interface CustomerAddressProps {
  customerId?: number;
  onBack?: () => void;
}

const CustomerAddress: React.FC<CustomerAddressProps> = ({ 
  customerId: propCustomerId,
  onBack 
}) => {
  const navigate = useNavigate();
  const { id: urlCustomerId } = useParams<{ id: string }>();
  
  const customerId = propCustomerId || (urlCustomerId ? parseInt(urlCustomerId) : 0);
  
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [defaultFilter, setDefaultFilter] = useState<string>("ALL");
  const [submitting, setSubmitting] = useState(false);
  
  // Customer data from CRM
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [form, setForm] = useState({
    id: null as number | null,
    customerId: customerId,
    customerNumber: "",
    customerName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    landmark: "",
    type: "SHIPPING",
    active: true,
    defaultDelivery: false,
    defaultBilling: false,
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ================= API FUNCTIONS =================

  // Fetch customer details from CRM
  const fetchCustomerDetails = async (id: number) => {
    if (!id) return null;
    
    try {
      const response = await axios.get(API.getCustomerById(id));
      const customerData = response.data;
      setCustomer(customerData);
      setSelectedCustomer(customerData);
      return customerData;
    } catch (err: any) {
      console.error("Error fetching customer:", err);
      toast.error("Failed to fetch customer details");
      return null;
    }
  };

  // Fetch addresses for a specific customer
  const fetchAddresses = async (customerId: number) => {
    if (!customerId) {
      setAddresses([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(API.getAll(customerId));
      setAddresses(response.data || []);
    } catch (err: any) {
      console.error("Error fetching addresses:", err);
      toast.error(err.response?.data?.message || "Failed to fetch addresses!");
    } finally {
      setLoading(false);
    }
  };

  const createAddress = async (data: any) => {
    try {
      const response = await axios.post(API.create, data);
      toast.success("Address created successfully!");
      return response.data;
    } catch (err: any) {
      console.error("Error creating address:", err);
      toast.error(err.response?.data?.message || "Failed to create address!");
      throw err;
    }
  };

  const updateAddress = async (id: number, data: any) => {
    try {
      const response = await axios.put(API.update(id), data);
      toast.success("Address updated successfully!");
      return response.data;
    } catch (err: any) {
      console.error("Error updating address:", err);
      toast.error(err.response?.data?.message || "Failed to update address!");
      throw err;
    }
  };

  const deleteAddress = async (id: number) => {
    try {
      await axios.delete(API.delete(id));
      toast.success("Address deleted successfully!");
      setShowDeleteModal(false);
      setSelectedAddress(null);
      if (customerId) {
        await fetchAddresses(customerId);
      }
    } catch (err: any) {
      console.error("Error deleting address:", err);
      toast.error(err.response?.data?.message || "Failed to delete address!");
      throw err;
    }
  };

  // ================= FETCH =================

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetails(customerId);
      fetchAddresses(customerId);
    }
  }, [customerId]);

  // ================= HANDLERS =================

  // Handle customer selection
  
  const handleCustomerSelect = async (selectedId: number) => {
  if (!selectedId) {
    setSelectedCustomer(null);
    setForm(prev => ({
      ...prev,
      customerId: 0,
      customerNumber: "",
      customerName: "",
    }));
    return;
  }
  
  try {
    const customerData = await fetchCustomerDetails(selectedId);
    if (customerData) {
      setSelectedCustomer(customerData);
      const customerNumber = getCustomerNumber(customerData);
      
      // Find default address with proper typing
      const defaultAddress = customerData.addresses?.find((addr: Address) => addr.defaultAddress);
      
      setForm(prev => ({
        ...prev,
        customerId: customerData.id,
        customerNumber: customerNumber,
        customerName: customerData.customerName || "",
        addressLine1: defaultAddress?.addressLine1 || "",
        addressLine2: defaultAddress?.addressLine2 || "",
        city: defaultAddress?.city || "",
        state: defaultAddress?.state || "",
        country: defaultAddress?.country || "India",
        postalCode: defaultAddress?.postalCode || "",
      }));
      
      fetchAddresses(selectedId);
    }
  } catch (error) {
    console.error("Error selecting customer:", error);
    toast.error("Failed to load customer details");
  }
};

  const handleViewAddress = (address: CustomerAddress) => {
    setSelectedAddress(address);
    setShowDetailModal(true);
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setEditingId(address.id);
    setForm({
      id: address.id,
      customerId: address.customerId,
      customerNumber: address.customerNumber || `CUST-${address.customerId}`,
      customerName: address.customerName,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || "",
      city: address.city,
      state: address.state,
      country: address.country,
      postalCode: address.postalCode,
      landmark: address.landmark || "",
      type: address.type || "SHIPPING",
      active: address.active,
      defaultDelivery: address.defaultDelivery,
      defaultBilling: address.defaultBilling,
    });
    setShowFormModal(true);
  };

  const handleDeleteClick = (address: CustomerAddress) => {
    setSelectedAddress(address);
    setShowDeleteModal(true);
  };

 const handleAddAddress = () => {
  setEditingId(null);
  
  // Case 1: We have a customer object (from page context)
  if (customer) {
    const customerNumber = getCustomerNumber(customer);
    setForm({
      id: null,
      customerId: customer.id,
      customerNumber: customerNumber,
      customerName: customer.customerName || "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      landmark: "",
      type: "SHIPPING",
      active: true,
      defaultDelivery: false,
      defaultBilling: false,
    });
    setSelectedCustomer(customer);
    setShowFormModal(true);
    return;
  }
  
  // Case 2: We have customerId but no customer object
  if (customerId) {
    fetchCustomerDetails(customerId).then((customerData) => {
      if (customerData) {
        const customerNumber = getCustomerNumber(customerData);
        setForm({
          id: null,
          customerId: customerData.id,
          customerNumber: customerNumber,
          customerName: customerData.customerName || "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          country: "",
          postalCode: "",
          landmark: "",
          type: "SHIPPING",
          active: true,
          defaultDelivery: false,
          defaultBilling: false,
        });
        setSelectedCustomer(customerData);
        setShowFormModal(true);
      } else {
        toast.error("Failed to load customer details");
      }
    });
    return;
  }
  
  // Case 3: No customer - show empty form with select option
  setForm({
    id: null,
    customerId: 0,
    customerNumber: "",
    customerName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    landmark: "",
    type: "SHIPPING",
    active: true,
    defaultDelivery: false,
    defaultBilling: false,
  });
  setSelectedCustomer(null);
  setShowFormModal(true);
};

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else if (type === "number") {
      setForm((prev) => ({
        ...prev,
        [name]: value === "" ? 0 : Number(value),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerId || !form.customerName || !form.addressLine1 || !form.city || !form.state || !form.postalCode) {
      toast.warning("Please fill in all required fields");
      return;
    }

    // Get customer number from selected customer or use form value
    let customerNumber = form.customerNumber;
    
    // If we have the customer object, get the number from there
    if (selectedCustomer) {
      customerNumber = getCustomerNumber(selectedCustomer);
    }
    
    // If still empty, generate one
    if (!customerNumber) {
      customerNumber = `CUST-${form.customerId}`;
    }

    const payload = {
      customerId: Number(form.customerId),
      customerNumber: customerNumber,
      customerName: form.customerName,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2 || "",
      city: form.city,
      state: form.state,
      country: form.country || "India",
      postalCode: form.postalCode,
      landmark: form.landmark || "",
      defaultDelivery: form.defaultDelivery,
      defaultBilling: form.defaultBilling,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateAddress(editingId, payload);
      } else {
        await createAddress(payload);
      }
      
      setShowFormModal(false);
      setEditingId(null);
      if (customerId) {
        await fetchAddresses(customerId);
      }
    } catch (err) {
      // Error already handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedAddress) {
      await deleteAddress(selectedAddress.id);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/customers");
    }
  };


  // ================= FILTER =================

const filteredAddresses = useMemo(() => {
  return addresses.filter((a: CustomerAddress) => {
    const matchesSearch =
      a.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      a.customerNumber?.toLowerCase().includes(search.toLowerCase()) ||
      a.city?.toLowerCase().includes(search.toLowerCase()) ||
      a.state?.toLowerCase().includes(search.toLowerCase()) ||
      String(a.customerId).includes(search) ||
      String(a.id).includes(search);

    const matchesActive =
      activeFilter === "ALL" || 
      (activeFilter === "ACTIVE" && a.active) ||
      (activeFilter === "INACTIVE" && !a.active);

    const matchesDefault =
      defaultFilter === "ALL" ||
      (defaultFilter === "DELIVERY" && a.defaultDelivery) ||
      (defaultFilter === "BILLING" && a.defaultBilling);

    return matchesSearch && matchesActive && matchesDefault;
  });
}, [addresses, search, activeFilter, defaultFilter]);

 // ================= STATS =================

const getStats = () => ({
  total: addresses.length,
  active: addresses.filter((a: CustomerAddress) => a.active).length,
  inactive: addresses.filter((a: CustomerAddress) => !a.active).length,
  defaultDelivery: addresses.filter((a: CustomerAddress) => a.defaultDelivery).length,
  defaultBilling: addresses.filter((a: CustomerAddress) => a.defaultBilling).length,
});

const stats = getStats();

  // ================= TABLE COLUMNS =================

  const tableColumns: ColumnDef<CustomerAddress>[] = [
    {
      key: "addressLine1",
      label: "Address",
      sortable: true,
      headerClassName: "w-[35%] text-left",
      className: "w-[35%]",
      render: (address) => (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <HomeIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700 truncate">{address.addressLine1}</span>
          </div>
          {address.addressLine2 && (
            <span className="text-xs text-slate-500 truncate ml-5">{address.addressLine2}</span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-5">
            <span>{address.city}</span>
            <span>•</span>
            <span>{address.state}</span>
            <span>•</span>
            <span className="text-slate-400">{address.postalCode}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-5">
            <GlobeAltIcon className="h-3 w-3" />
            <span>{address.country}</span>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (address) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${
          address.type === "SHIPPING" 
            ? "bg-blue-50 text-blue-700 border-blue-200" 
            : "bg-purple-50 text-purple-700 border-purple-200"
        }`}>
          {address.type || "SHIPPING"}
        </span>
      ),
    },
    {
      key: "defaults",
      label: "Defaults",
      sortable: false,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (address) => (
        <div className="flex flex-wrap gap-1">
          {address.defaultDelivery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
              📦 Delivery
            </span>
          )}
          {address.defaultBilling && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
              💳 Billing
            </span>
          )}
          {!address.defaultDelivery && !address.defaultBilling && (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (address) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${
          address.active 
            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
            : "bg-slate-50 text-slate-600 border-slate-200"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
            address.active ? "bg-emerald-500" : "bg-slate-400"
          }`} />
          {address.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[15%] text-right pr-4",
      className: "w-[15%] text-right",
      render: (address) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleViewAddress(address)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
            title="View Address"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleEditAddress(address)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Address"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteClick(address)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Address"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ================= UI =================

  return (
    <>
      <PageMeta 
        title={`Addresses - ${customer?.customerName || 'Customer'}`} 
        description={`Manage addresses for ${customer?.customerName || 'customer'}`} 
      />
      <PageBreadcrumb pageTitle="Customer Addresses" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* HEADER with Back button */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Go Back"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <MapPinIcon className="h-6 w-6 text-cyan-600" />
                {customer?.customerName || 'Customer'} Addresses
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {addresses.length} address{addresses.length !== 1 ? 'es' : ''} on record
              </p>
            </div>
          </div>
          <AddButton onClick={handleAddAddress} label="Add Address" className="-mt-[264px]" />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
          <StatsCard 
            label="Total Addresses" 
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
            label="Delivery Default" 
            value={stats.defaultDelivery}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard 
            label="Billing Default" 
            value={stats.defaultBilling}
            gradient="from-purple-50 to-violet-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder="Search addresses by city, state, or postal code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FunnelIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm text-gray-600">Filters</span>
          </button>
        </div>

        {/* FILTERS */}
        {showFilters && (
          <div className="p-4 border rounded bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Address
              </label>
              <select
                value={defaultFilter}
                onChange={(e) => setDefaultFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All</option>
                <option value="DELIVERY">Default Delivery</option>
                <option value="BILLING">Default Billing</option>
              </select>
            </div>

            <div className="flex items-end md:col-span-2">
              {(activeFilter !== "ALL" || defaultFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setActiveFilter("ALL");
                    setDefaultFilter("ALL");
                  }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  ✕ Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* TABLE */}
        <ReusableTable<CustomerAddress>
          data={filteredAddresses}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="addressLine1"
          defaultSortOrder="asc"
          onRowClick={handleViewAddress}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <MapPinIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">
                {customer ? `No addresses found for ${customer.customerName}` : "No Addresses Found"}
              </p>
              {search || activeFilter !== "ALL" || defaultFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={handleAddAddress}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add first address for this customer
                </button>
              )}
            </div>
          }
        />

        {/* ================= CREATE/EDIT MODAL ================= */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handleSaveAddress}
              className="bg-white p-6 rounded-xl w-[700px] max-h-[90vh] overflow-y-auto relative"
            >
              {/* Close Button - X Mark */}
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setEditingId(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                disabled={submitting}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MapPinIcon className="h-6 w-6 text-cyan-600" />
                {editingId ? "Edit Address" : "Add Customer Address"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Customer info - Read-only display */}
                <div className="col-span-2 bg-gray-50 p-3 rounded-lg mb-2">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {form.customerName || "No customer selected"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Customer ID: #{form.customerId || "Not set"} • 
                        Number: {form.customerNumber || "Not set"}
                      </p>
                    </div>
                  </div>
                  {selectedCustomer && (
                    <div className="mt-1 text-xs text-gray-400">
                      Tax: {selectedCustomer.taxNumber || "N/A"} • 
                      Reg: {selectedCustomer.registrationNumber || "N/A"}
                    </div>
                  )}
                </div>

                {/* Address Type */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Type
                  </label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="SHIPPING">Shipping</option>
                    <option value="BILLING">Billing</option>
                    <option value="OFFICE">Office</option>
                    <option value="HOME">Home</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <FloatingInput
                  label="Address Line 1 *"
                  name="addressLine1"
                  value={form.addressLine1}
                  onChange={handleChange}
                  required
                />

                <FloatingInput
                  label="Address Line 2"
                  name="addressLine2"
                  value={form.addressLine2}
                  onChange={handleChange}
                />

                <FloatingInput
                  label="City *"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                />

                <FloatingInput
                  label="State *"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  required
                />

                <FloatingInput
                  label="Country"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                />

                <FloatingInput
                  label="Postal Code *"
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  required
                />

                <FloatingInput
                  label="Landmark"
                  name="landmark"
                  value={form.landmark}
                  onChange={handleChange}
                />

                <div className="col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      name="active"
                      checked={form.active}
                      onChange={handleChange}
                      className="h-4 w-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                    />
                    Active
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      name="defaultDelivery"
                      checked={form.defaultDelivery}
                      onChange={handleChange}
                      className="h-4 w-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                    />
                    Default Delivery
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      name="defaultBilling"
                      checked={form.defaultBilling}
                      onChange={handleChange}
                      className="h-4 w-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                    />
                    Default Billing
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowFormModal(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : (editingId ? "Update" : "Create")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= DETAIL VIEW MODAL ================= */}
        {showDetailModal && selectedAddress && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[600px] max-h-[90vh] overflow-y-auto relative">
              {/* Close Button - X Mark */}
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <MapPinIcon className="h-6 w-6 text-cyan-600" />
                  Address Details
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">Customer</label>
                  <p className="font-medium">{selectedAddress.customerName}</p>
                  <p className="text-sm text-gray-600">#{selectedAddress.customerNumber}</p>
                </div>

                <div className="border-t pt-4">
                  <label className="text-xs text-gray-500">Address</label>
                  <div className="bg-gray-50 p-3 rounded-lg mt-1">
                    <p className="font-medium">{selectedAddress.addressLine1}</p>
                    {selectedAddress.addressLine2 && <p>{selectedAddress.addressLine2}</p>}
                    <p>{selectedAddress.city}, {selectedAddress.state}</p>
                    <p>{selectedAddress.country} - {selectedAddress.postalCode}</p>
                    {selectedAddress.landmark && (
                      <p className="text-sm text-gray-500">Landmark: {selectedAddress.landmark}</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-xs text-gray-500">Status</label>
                  <div className="space-y-1 mt-1">
                    <p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedAddress.active 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      }`}>
                        {selectedAddress.active ? "Active" : "Inactive"}
                      </span>
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedAddress.defaultDelivery && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          📦 Default Delivery
                        </span>
                      )}
                      {selectedAddress.defaultBilling && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          💳 Default Billing
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleEditAddress(selectedAddress);
                    }}
                    className="px-4 py-2 bg-cyan-50 text-cyan-600 rounded-lg hover:bg-cyan-100 text-sm font-medium"
                  >
                    <PencilSquareIcon className="h-4 w-4 inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleDeleteClick(selectedAddress);
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                  >
                    <TrashIcon className="h-4 w-4 inline mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= DELETE CONFIRMATION MODAL ================= */}
        {showDeleteModal && selectedAddress && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[450px] relative">
              {/* Close Button - X Mark */}
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedAddress(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Address</h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete this address?
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedAddress.addressLine1}, {selectedAddress.city}
                  </p>
                  <p className="text-xs text-red-500 mt-2">⚠️ This action cannot be undone.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedAddress(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Delete Address
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ================= EYE ICON COMPONENT =================

const EyeIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export default CustomerAddress;