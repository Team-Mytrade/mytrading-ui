import React, { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import {
  XMarkIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  MapPinIcon,
  HomeIcon,
  BuildingStorefrontIcon,
  TruckIcon,
  BriefcaseIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  CheckIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { BackButton } from "../../components/common/BackButton";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";

// Enums
enum AddressType {
  BILLING = "BILLING",
  SHIPPING = "SHIPPING",
  OFFICE = "OFFICE",
  WAREHOUSE = "WAREHOUSE",
  BRANCH = "BRANCH",
  OTHER = "OTHER",
}

enum CustomerStatus {
  LEAD = "LEAD",
  ACTIVE = "ACTIVE",
  CREDIT_HOLD = "CREDIT_HOLD",
  BLOCKED = "BLOCKED",
  INACTIVE = "INACTIVE",
}

enum CustomerType {
  WHOLESALE = "WHOLESALE",
  RETAIL = "RETAIL",
  CORPORATE = "CORPORATE",
  INDIVIDUAL = "INDIVIDUAL",
}

interface Address {
  type: AddressType;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  defaultAddress: boolean;
}

interface Customer {
  id?: number;
  customerName: string;
  tradeName?: string;
  taxNumber?: string;
  registrationNumber?: string;
  customerType: CustomerType;
  status: CustomerStatus;
  phone: string;
  email: string;
  website?: string;
  creditLimit?: number;
  currentCredit?: number;
  paymentTerms?: string;
  currencyCode?: string;
  active: boolean;
  addresses: Address[];
}

const API_URL = "/v1/api/crm/customers";

const addressTypeOptions = [
  { id: AddressType.BILLING, name: "Billing Address", icon: HomeIcon },
  { id: AddressType.SHIPPING, name: "Shipping Address", icon: TruckIcon },
  { id: AddressType.OFFICE, name: "Office Address", icon: BuildingOfficeIcon },
  { id: AddressType.WAREHOUSE, name: "Warehouse Address", icon: BuildingStorefrontIcon },
  { id: AddressType.BRANCH, name: "Branch Address", icon: BriefcaseIcon },
  { id: AddressType.OTHER, name: "Other Address", icon: MapPinIcon },
];

const CustomerFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Customer Form State
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
    customerName: "",
    tradeName: "",
    taxNumber: "",
    registrationNumber: "",
    customerType: CustomerType.WHOLESALE,
    status: CustomerStatus.ACTIVE,
    phone: "",
    email: "",
    website: "",
    creditLimit: 0,
    currentCredit: 0,
    paymentTerms: "",
    currencyCode: "INR",
    active: true,
    addresses: [],
  });

  // Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<Address>({
    type: AddressType.BILLING,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    defaultAddress: false,
  });
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);

  // Fetch customer data if editing
  useEffect(() => {
    if (isEditing && id) {
      fetchCustomerDetails();
    }
  }, [id, isEditing]);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/${id}`);
      const customerData = res.data;
      setCustomerForm({
        id: customerData.id,
        customerName: customerData.customerName,
        tradeName: customerData.tradeName || "",
        taxNumber: customerData.taxNumber || "",
        registrationNumber: customerData.registrationNumber || "",
        customerType: customerData.customerType,
        status: customerData.status,
        phone: customerData.phone,
        email: customerData.email,
        website: customerData.website || "",
        creditLimit: customerData.creditLimit || 0,
        currentCredit: customerData.currentCredit || 0,
        paymentTerms: customerData.paymentTerms || "",
        currencyCode: customerData.currencyCode || "INR",
        active: customerData.active,
        addresses: customerData.addresses || [],
      });
    } catch (err) {
      console.error("Error fetching customer:", err);
      ToasterService.error("Failed to load customer details");
      navigate("/customer-management");
    } finally {
      setLoading(false);
    }
  };

  // Address Management
  const addAddress = () => {
    if (!currentAddress.addressLine1 || !currentAddress.city || !currentAddress.state || !currentAddress.country) {
      ToasterService.error("Please fill in all required address fields");
      return;
    }

    if (editingAddressIndex !== null) {
      const updatedAddresses = [...(customerForm.addresses || [])];
      updatedAddresses[editingAddressIndex] = { ...currentAddress };
      setCustomerForm({ ...customerForm, addresses: updatedAddresses });
      setEditingAddressIndex(null);
    } else {
      setCustomerForm({
        ...customerForm,
        addresses: [...(customerForm.addresses || []), { ...currentAddress }],
      });
    }

    resetAddressForm();
    setShowAddressModal(false);
    ToasterService.success(editingAddressIndex !== null ? "Address updated" : "Address added");
  };

  const editAddress = (index: number) => {
    const address = customerForm.addresses?.[index];
    if (address) {
      setCurrentAddress(address);
      setEditingAddressIndex(index);
      setShowAddressModal(true);
    }
  };

  const removeAddress = (index: number) => {
    const updatedAddresses = [...(customerForm.addresses || [])];
    updatedAddresses.splice(index, 1);
    setCustomerForm({ ...customerForm, addresses: updatedAddresses });
    ToasterService.success("Address removed");
  };

  const resetAddressForm = () => {
    setCurrentAddress({
      type: AddressType.BILLING,
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      defaultAddress: false,
    });
    setEditingAddressIndex(null);
  };

  const setDefaultAddress = (index: number) => {
    const updatedAddresses = (customerForm.addresses || []).map((addr, i) => ({
      ...addr,
      defaultAddress: i === index,
    }));
    setCustomerForm({ ...customerForm, addresses: updatedAddresses });
    ToasterService.success("Default address updated");
  };

  // Form Submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!customerForm.customerName) {
      ToasterService.error("Customer name is required");
      return;
    }

    if (!customerForm.email) {
      ToasterService.error("Email is required");
      return;
    }

    if (!customerForm.phone) {
      ToasterService.error("Phone is required");
      return;
    }

    const payload = {
      customerName: customerForm.customerName,
      tradeName: customerForm.tradeName,
      taxNumber: customerForm.taxNumber,
      registrationNumber: customerForm.registrationNumber,
      customerType: customerForm.customerType,
      status: customerForm.status,
      phone: customerForm.phone,
      email: customerForm.email,
      website: customerForm.website,
      creditLimit: Number(customerForm.creditLimit),
      currentCredit: Number(customerForm.currentCredit),
      paymentTerms: customerForm.paymentTerms,
      currencyCode: customerForm.currencyCode,
      active: customerForm.active,
      addresses: customerForm.addresses,
    };

    setSaving(true);
    try {
      if (isEditing && customerForm.id) {
        await axios.put(`${API_URL}/${customerForm.id}`, payload);
        ToasterService.success("Customer updated successfully!");
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success("Customer created successfully!");
      }
      navigate("/customer-management");
    } catch (err: any) {
      console.error("Error saving customer:", err);
      ToasterService.error(err.response?.data?.message || "Failed to save customer!");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={isEditing ? "Edit Customer" : "Create Customer"} description="Manage customer information" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-700 p-8 text-white shadow-xl shadow-cyan-900/10 transition-transform duration-300 hover:scale-[1.01]">
          <div className="relative z-10 flex items-center gap-5">
            <button
              onClick={() => navigate("/customer-management")}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 transition-all backdrop-blur-md"
            >
              <ArrowLeftIcon className="h-6 w-6 text-white" />
            </button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                {isEditing ? "Edit Customer" : "Create New Customer"}
              </h1>
              <p className="text-cyan-100 text-sm font-medium">
                {isEditing ? "Update and manage customer details accurately" : "Set up a new client profile for your database"}
              </p>
            </div>
          </div>
          {/* Decorative shapes */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white opacity-5 blur-3xl"></div>
          <div className="absolute -bottom-32 right-10 h-64 w-64 rounded-full bg-cyan-300 opacity-20 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-y-1/2 h-full w-1/2 bg-gradient-to-r from-transparent to-white/5 skew-x-12"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-cyan-100">
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100/80">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-100/50">
                <BuildingOfficeIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5">Essential details</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingInput
                label="Customer Name *"
                value={customerForm.customerName || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })}
                required
              />
              <FloatingInput
                label="Trade Name"
                value={customerForm.tradeName || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, tradeName: e.target.value })}
              />
              <FloatingInput
                label="Tax Number"
                value={customerForm.taxNumber || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, taxNumber: e.target.value })}
              />
              <FloatingInput
                label="Registration Number"
                value={customerForm.registrationNumber || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, registrationNumber: e.target.value })}
              />
              <FloatingSelect
                label="Customer Type"
                value={customerForm.customerType || CustomerType.WHOLESALE}
                onChange={(e) => setCustomerForm({ ...customerForm, customerType: e.target.value as CustomerType })}
                options={[
                  { id: CustomerType.WHOLESALE, name: "Wholesale" },
                  { id: CustomerType.RETAIL, name: "Retail" },
                  { id: CustomerType.CORPORATE, name: "Corporate" },
                  { id: CustomerType.INDIVIDUAL, name: "Individual" },
                ]}
              />
              <FloatingSelect
                label="Status"
                value={customerForm.status || CustomerStatus.ACTIVE}
                onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value as CustomerStatus })}
                options={[
                  { id: CustomerStatus.LEAD, name: "Lead" },
                  { id: CustomerStatus.ACTIVE, name: "Active" },
                  { id: CustomerStatus.CREDIT_HOLD, name: "Credit Hold" },
                  { id: CustomerStatus.BLOCKED, name: "Blocked" },
                  { id: CustomerStatus.INACTIVE, name: "Inactive" },
                ]}
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-cyan-100">
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100/80">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-100/50">
                <EnvelopeIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Contact Information</h2>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5">Communication details</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingInput
                label="Email *"
                type="email"
                value={customerForm.email || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                required
              />
              <FloatingInput
                label="Phone *"
                type="tel"
                value={customerForm.phone || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                required
              />
              <FloatingInput
                label="Website"
                type="url"
                value={customerForm.website || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, website: e.target.value })}
              />
            </div>
          </div>

          {/* Financial Information */}
          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-cyan-100">
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100/80">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-100/50">
                <CurrencyIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Financial Information</h2>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5">Credit & billing</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FloatingInput
                label="Credit Limit"
                type="number"
                value={customerForm.creditLimit || 0}
                onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: Number(e.target.value) })}
              />
              <FloatingInput
                label="Current Credit"
                type="number"
                value={customerForm.currentCredit || 0}
                onChange={(e) => setCustomerForm({ ...customerForm, currentCredit: Number(e.target.value) })}
              />
              <FloatingInput
                label="Payment Terms"
                value={customerForm.paymentTerms || ""}
                onChange={(e) => setCustomerForm({ ...customerForm, paymentTerms: e.target.value })}
              />
              <FloatingInput
                label="Currency Code"
                value={customerForm.currencyCode || "INR"}
                onChange={(e) => setCustomerForm({ ...customerForm, currencyCode: e.target.value })}
              />
              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customerForm.active}
                    onChange={(e) => setCustomerForm({ ...customerForm, active: e.target.checked })}
                    className="h-4 w-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-700">Active Customer</span>
                </label>
              </div>
            </div>
          </div>

          {/* Addresses Section */}
          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-cyan-100">
            <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-100/80">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-100/50">
                  <MapPinIcon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Addresses</h2>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5">Locations & Shipping</p>
                </div>
              </div>
              {!showAddressModal && (
                <button
                  type="button"
                  onClick={() => {
                    resetAddressForm();
                    setShowAddressModal(true);
                  }}
                  className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 transition-colors flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Address
                </button>
              )}
            </div>

            {showAddressModal ? (
              <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingAddressIndex !== null ? "Edit Address" : "Add Address"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Enter address details for this customer</p>
                  </div>
                  <button type="button" onClick={() => setShowAddressModal(false)} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <FloatingSelect
                    label="Address Type *"
                    value={currentAddress.type}
                    onChange={(e) => setCurrentAddress({ ...currentAddress, type: e.target.value as AddressType })}
                    options={addressTypeOptions.map(opt => ({ id: opt.id, name: opt.name }))}
                  />
                  <FloatingInput
                    label="Address Line 1 *"
                    value={currentAddress.addressLine1}
                    onChange={(e) => setCurrentAddress({ ...currentAddress, addressLine1: e.target.value })}
                    required={false}
                  />
                  <FloatingInput
                    label="Address Line 2"
                    value={currentAddress.addressLine2 || ""}
                    onChange={(e) => setCurrentAddress({ ...currentAddress, addressLine2: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FloatingInput
                      label="City *"
                      value={currentAddress.city}
                      onChange={(e) => setCurrentAddress({ ...currentAddress, city: e.target.value })}
                      required={false}
                    />
                    <FloatingInput
                      label="State *"
                      value={currentAddress.state}
                      onChange={(e) => setCurrentAddress({ ...currentAddress, state: e.target.value })}
                      required={false}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FloatingInput
                      label="Postal Code"
                      value={currentAddress.postalCode}
                      onChange={(e) => setCurrentAddress({ ...currentAddress, postalCode: e.target.value })}
                    />
                    <FloatingInput
                      label="Country *"
                      value={currentAddress.country}
                      onChange={(e) => setCurrentAddress({ ...currentAddress, country: e.target.value })}
                      required={false}
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={currentAddress.defaultAddress}
                      onChange={(e) => setCurrentAddress({ ...currentAddress, defaultAddress: e.target.checked })}
                      className="h-4 w-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-gray-700">Set as default address</span>
                  </label>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(false)}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addAddress}
                    disabled={!currentAddress.addressLine1 || !currentAddress.city || !currentAddress.state || !currentAddress.country}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingAddressIndex !== null ? "Update Address" : "Save Address"}
                  </button>
                </div>
              </div>
            ) : customerForm.addresses && customerForm.addresses.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {customerForm.addresses.map((addr, idx) => {
                  const AddressIcon = addressTypeOptions.find(opt => opt.id === addr.type)?.icon || MapPinIcon;
                  return (
                    <div key={idx} className="relative overflow-hidden bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:border-cyan-200 group/card">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-blue-500 opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AddressIcon className="h-4 w-4 text-cyan-600" />
                            <span className="text-sm font-semibold text-gray-700">{addr.type}</span>
                            {addr.defaultAddress && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{addr.addressLine1}</p>
                          {addr.addressLine2 && <p className="text-sm text-gray-600">{addr.addressLine2}</p>}
                          <p className="text-sm text-gray-600">
                            {addr.city}, {addr.state} - {addr.postalCode}
                          </p>
                          <p className="text-sm text-gray-600">{addr.country}</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(idx)}
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                            title="Set as Default"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => editAddress(idx)}
                            className="p-1.5 text-gray-400 hover:text-cyan-600 rounded-lg hover:bg-cyan-50 transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAddress(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <MapPinIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-2">No addresses added yet</p>
                <button
                  type="button"
                  onClick={() => {
                    resetAddressForm();
                    setShowAddressModal(true);
                  }}
                  className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                >
                  Add your first address
                </button>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="mt-8 flex flex-row items-center justify-between sm:justify-end gap-3 sm:gap-4 p-3 sm:p-4 bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <button
              type="button"
              onClick={() => navigate("/customer-management")}
              className="flex-1 sm:flex-none px-2 sm:px-6 h-[44px] flex items-center justify-center rounded-xl text-gray-600 font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[1.5] sm:flex-none px-2 sm:px-8 h-[44px] flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 !text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:from-cyan-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="!text-white whitespace-nowrap">Saving...</span>
                </>
              ) : (
                <>
                  <CheckIcon className="h-5 w-5 !text-white flex-shrink-0" />
                  <span className="!text-white whitespace-nowrap">{isEditing ? "Update Customer" : "Save Customer"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
};

// Currency Icon component
const CurrencyIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
  </svg>
);

export default CustomerFormPage;