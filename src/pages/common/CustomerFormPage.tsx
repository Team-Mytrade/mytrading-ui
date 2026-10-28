import React, { FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  CheckIcon,
  EnvelopeIcon,
  HomeIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  TruckIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { CUSTOMER_TYPE_OPTIONS, apiError } from "../CRM/crmShared";
import { formatMoney } from "../Dashboard/dashboardKit";
import { companyCurrency, currencyChoices } from "../../company/format";

// Create and edit one customer. Field rules follow the CRM service (Customer entity / CustomerService).

const API_URL = "/v1/api/common/customers";
const SALES_PERSONS_API = "/v1/api/sales/sales-persons";
const FORM_ID = "customer-form";

const STATUS_OPTIONS = [
  { id: "ACTIVE", name: "Active" },
  { id: "LEAD", name: "Lead" },
  { id: "CREDIT_HOLD", name: "Credit hold" },
  { id: "BLOCKED", name: "Blocked" },
  { id: "INACTIVE", name: "Inactive" },
];

const PAYMENT_TERM_OPTIONS = [
  { id: "IMMEDIATE", name: "Due on receipt" },
  { id: "NET15", name: "Net 15 days" },
  { id: "NET30", name: "Net 30 days" },
  { id: "NET45", name: "Net 45 days" },
  { id: "NET60", name: "Net 60 days" },
  { id: "NET90", name: "Net 90 days" },
];

// "AED — UAE Dirham": the company's currency first, then Gulf, INR and major currencies
const currencyNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" });
  } catch {
    return null;
  }
})();
const currencyOptions = (stored?: string) =>
  currencyChoices(stored).map((code) => ({ id: code, name: `${code} — ${currencyNames?.of(code) ?? code}` }));

const ADDRESS_TYPES = [
  { id: "BILLING", name: "Billing", icon: HomeIcon },
  { id: "SHIPPING", name: "Shipping", icon: TruckIcon },
  { id: "OFFICE", name: "Office", icon: BuildingOfficeIcon },
  { id: "WAREHOUSE", name: "Warehouse", icon: BuildingStorefrontIcon },
  { id: "BRANCH", name: "Branch", icon: BriefcaseIcon },
  { id: "OTHER", name: "Other", icon: MapPinIcon },
];

// Same patterns the service validates with
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Address {
  id?: number;
  type: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  defaultAddress: boolean;
}

interface CustomerForm {
  customerName: string;
  tradeName: string;
  customerType: string;
  status: string;
  taxNumber: string;
  registrationNumber: string;
  email: string;
  phone: string;
  website: string;
  salesPersonId: string;
  paymentTerms: string;
  currencyCode: string;
  // Blank = no credit limit (Sales skips the credit check); 0 would block every order
  creditLimit: string;
  addresses: Address[];
}

// Kept by Sales; sent back unchanged so editing the customer never resets them
interface SalesFigures {
  customerCode?: string;
  currentCredit: number;
  outstandingBalance: number;
}

interface SalesPerson {
  id: number;
  name: string;
  code?: string;
  active?: boolean;
}

type Errors = Partial<Record<keyof CustomerForm | "addresses", string>>;

const EMPTY_FORM: CustomerForm = {
  customerName: "",
  tradeName: "",
  customerType: "WHOLESALE",
  status: "ACTIVE",
  taxNumber: "",
  registrationNumber: "",
  email: "",
  phone: "",
  website: "",
  salesPersonId: "",
  paymentTerms: "NET30",
  get currencyCode() {
    return companyCurrency();
  },
  creditLimit: "",
  addresses: [],
};

const EMPTY_ADDRESS: Address = {
  type: "BILLING",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "India",
  postalCode: "",
  defaultAddress: false,
};

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const validate = (form: CustomerForm): Errors => {
  const errors: Errors = {};
  if (!form.customerName.trim()) errors.customerName = "Customer name is required";
  if (!form.customerType) errors.customerType = "Choose the customer type";
  if (!form.email.trim()) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address";
  if (!form.phone.trim()) errors.phone = "Phone is required";
  else if (!PHONE_PATTERN.test(form.phone.trim()))
    errors.phone = "7–20 digits; spaces, dashes, brackets and a leading + are allowed";
  if (form.creditLimit !== "" && (Number.isNaN(Number(form.creditLimit)) || Number(form.creditLimit) < 0))
    errors.creditLimit = "Credit limit can't be negative";
  return errors;
};

const validateAddress = (address: Address): Partial<Record<keyof Address, string>> => {
  const errors: Partial<Record<keyof Address, string>> = {};
  if (!address.addressLine1.trim()) errors.addressLine1 = "Address is required";
  if (!address.city.trim()) errors.city = "City is required";
  if (!address.state.trim()) errors.state = "State is required";
  if (!address.country.trim()) errors.country = "Country is required";
  return errors;
};

/* ---------------------------------------------------------------- layout pieces */

const Section: React.FC<{
  title: string;
  description?: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon: Icon, action, children }) => (
  <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      {action}
    </header>
    <div className="px-5 pb-1 pt-5">{children}</div>
  </section>
);

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="-mt-3 mb-4 text-xs text-gray-500 dark:text-gray-400">{children}</p>
);

/* ---------------------------------------------------------------- page */

const CustomerFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<CustomerForm>(EMPTY_FORM);
  const [salesFigures, setSalesFigures] = useState<SalesFigures>({ currentCredit: 0, outstandingBalance: 0 });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[] | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Address being added (index = null) or edited (index = position)
  const [addressDraft, setAddressDraft] = useState<{ index: number | null; value: Address } | null>(null);
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof Address, string>>>({});

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);

  useEffect(() => {
    // Sales persons come from the Sales module; without access the field is simply left out
    axios
      .get(SALES_PERSONS_API)
      .then((res) => setSalesPersons(Array.isArray(res.data) ? res.data : res.data?.content ?? []))
      .catch(() => setSalesPersons(null));
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    setLoading(true);
    axios
      .get(`${API_URL}/${id}`)
      .then(({ data }) => {
        const loaded: CustomerForm = {
          customerName: text(data.customerName),
          tradeName: text(data.tradeName),
          customerType: text(data.customerType) || "OTHER",
          status: text(data.status) || "ACTIVE",
          taxNumber: text(data.taxNumber),
          registrationNumber: text(data.registrationNumber),
          email: text(data.email),
          phone: text(data.phone),
          website: text(data.website),
          salesPersonId: text(data.salesPersonId),
          paymentTerms: text(data.paymentTerms),
          currencyCode: text(data.currencyCode) || companyCurrency(),
          creditLimit: text(data.creditLimit),
          addresses: (data.addresses ?? []).map((a: Address) => ({
            ...EMPTY_ADDRESS,
            ...a,
            addressLine2: a.addressLine2 ?? "",
            postalCode: a.postalCode ?? "",
            defaultAddress: Boolean(a.defaultAddress),
          })),
        };
        setForm(loaded);
        setInitialForm(loaded);
        setSalesFigures({
          customerCode: data.customerCode,
          currentCredit: Number(data.currentCredit) || 0,
          outstandingBalance: Number(data.outstandingBalance) || 0,
        });
      })
      .catch((err) => {
        ToasterService.error(apiError(err, "Failed to load customer details"));
        navigate("/customer-management");
      })
      .finally(() => setLoading(false));
  }, [id, isEditing, navigate]);

  const update = <K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      // After a failed save, errors clear as fields are fixed
      if (submitted) setErrors(validate(next));
      return next;
    });
  };

  /* ---------------- addresses ---------------- */

  const openAddress = (index: number | null) => {
    setAddressErrors({});
    setAddressDraft({
      index,
      value: index === null ? { ...EMPTY_ADDRESS, defaultAddress: form.addresses.length === 0 } : { ...form.addresses[index] },
    });
  };

  const saveAddress = () => {
    if (!addressDraft) return;
    const problems = validateAddress(addressDraft.value);
    setAddressErrors(problems);
    if (Object.keys(problems).length) return;

    const value = { ...addressDraft.value };
    let addresses =
      addressDraft.index === null
        ? [...form.addresses, value]
        : form.addresses.map((a, i) => (i === addressDraft.index ? value : a));
    // Exactly one default address
    const defaultIndex = addressDraft.index === null ? addresses.length - 1 : addressDraft.index;
    if (value.defaultAddress) addresses = addresses.map((a, i) => ({ ...a, defaultAddress: i === defaultIndex }));
    if (!addresses.some((a) => a.defaultAddress)) addresses[0] = { ...addresses[0], defaultAddress: true };
    update("addresses", addresses);
    setAddressDraft(null);
  };

  const removeAddress = (index: number) => {
    const addresses = form.addresses.filter((_, i) => i !== index);
    if (addresses.length && !addresses.some((a) => a.defaultAddress)) addresses[0] = { ...addresses[0], defaultAddress: true };
    update("addresses", addresses);
  };

  const makeDefault = (index: number) =>
    update("addresses", form.addresses.map((a, i) => ({ ...a, defaultAddress: i === index })));

  /* ---------------- save ---------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const problems = validate(form);
    setErrors(problems);
    if (Object.keys(problems).length) {
      ToasterService.error("Please fix the highlighted fields");
      return;
    }
    if (addressDraft) {
      ToasterService.error("Save or cancel the address you're editing first");
      return;
    }

    const salesPerson = salesPersons?.find((p) => String(p.id) === form.salesPersonId);
    const payload = {
      customerName: form.customerName.trim(),
      tradeName: form.tradeName.trim() || null,
      customerType: form.customerType,
      status: form.status,
      // Same rule as the status dropdown on the customer list
      active: form.status === "ACTIVE",
      taxNumber: form.taxNumber.trim() || null,
      registrationNumber: form.registrationNumber.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      website: form.website.trim() || null,
      salesPersonId: form.salesPersonId ? Number(form.salesPersonId) : null,
      salesPersonName: salesPerson?.name ?? null,
      paymentTerms: form.paymentTerms || null,
      currencyCode: form.currencyCode || companyCurrency(),
      creditLimit: form.creditLimit === "" ? null : Number(form.creditLimit),
      currentCredit: salesFigures.currentCredit,
      outstandingBalance: salesFigures.outstandingBalance,
      addresses: form.addresses,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/${id}`, payload);
        ToasterService.success("Customer updated");
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success("Customer created");
      }
      setInitialForm(form);
      navigate("/customer-management");
    } catch (err: any) {
      // Show the service's field errors next to the fields
      const fieldErrors = err?.response?.data?.fieldErrors as Record<string, string> | undefined;
      if (fieldErrors) setErrors((current) => ({ ...current, ...fieldErrors }));
      ToasterService.error(apiError(err, "Failed to save customer"));
    } finally {
      setSaving(false);
    }
  };

  const leave = () => (isDirty ? setConfirmLeave(true) : navigate("/customer-management"));

  // Keep a stored value that isn't in the standard lists (older records used free text)
  const paymentTermOptions = useMemo(
    () =>
      form.paymentTerms && !PAYMENT_TERM_OPTIONS.some((o) => o.id === form.paymentTerms)
        ? [...PAYMENT_TERM_OPTIONS, { id: form.paymentTerms, name: form.paymentTerms }]
        : PAYMENT_TERM_OPTIONS,
    [form.paymentTerms]
  );
  const currencySelectOptions = useMemo(() => currencyOptions(form.currencyCode), [form.currencyCode]);
  const salesPersonOptions = (salesPersons ?? [])
    .filter((p) => p.active !== false || String(p.id) === form.salesPersonId)
    .map((p) => ({ id: String(p.id), name: p.code ? `${p.name} (${p.code})` : p.name }));

  const title = isEditing ? "Edit Customer" : "New Customer";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageMeta title={title} description="Create or update a customer" />
      <PageBreadcrumb
        pageTitle={title}
        onBack={leave}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={leave}
              className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={FORM_ID}
              disabled={saving || loading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              {saving ? "Saving…" : isEditing ? "Save changes" : "Create customer"}
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-600/30 border-t-cyan-600" />
        </div>
      ) : (
        <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto pb-6">
          <div className="grid gap-4 xl:grid-cols-3">
            {/* ---------------- left: who they are ---------------- */}
            <div className="space-y-4 xl:col-span-2">
              <Section icon={BuildingOfficeIcon} title="Company" description="Legal name, type and registration details">
                <div className="grid gap-x-4 md:grid-cols-2">
                  <FloatingInput
                    label="Customer name"
                    name="customerName"
                    required
                    value={form.customerName}
                    error={errors.customerName}
                    onChange={(e) => update("customerName", e.target.value)}
                    maxLength={150}
                  />
                  <FloatingInput
                    label="Trade name"
                    name="tradeName"
                    value={form.tradeName}
                    onChange={(e) => update("tradeName", e.target.value)}
                    maxLength={150}
                  />
                  <FloatingSelect
                    label="Customer type *"
                    name="customerType"
                    value={form.customerType}
                    onChange={(e) => update("customerType", e.target.value)}
                    options={CUSTOMER_TYPE_OPTIONS}
                    includeEmptyOption={false}
                  />
                  <FloatingSelect
                    label="Status *"
                    name="status"
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                    options={STATUS_OPTIONS}
                    includeEmptyOption={false}
                  />
                  <FloatingInput
                    label="GSTIN / Tax number"
                    name="taxNumber"
                    value={form.taxNumber}
                    onChange={(e) => update("taxNumber", e.target.value.toUpperCase())}
                    maxLength={50}
                  />
                  <FloatingInput
                    label="Registration number"
                    name="registrationNumber"
                    value={form.registrationNumber}
                    onChange={(e) => update("registrationNumber", e.target.value)}
                    maxLength={50}
                  />
                </div>
              </Section>

              <Section icon={EnvelopeIcon} title="Contact details" description="Main email and phone for the company; people go under Key Contacts">
                <div className="grid gap-x-4 md:grid-cols-2">
                  <FloatingInput
                    label="Email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    error={errors.email}
                    onChange={(e) => update("email", e.target.value)}
                    maxLength={120}
                  />
                  <FloatingInput
                    label="Phone"
                    name="phone"
                    type="tel"
                    required
                    value={form.phone}
                    error={errors.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    maxLength={50}
                  />
                  <div>
                    <FloatingInput
                      label="Website"
                      name="website"
                      type="url"
                      value={form.website}
                      onChange={(e) => update("website", e.target.value)}
                      maxLength={120}
                    />
                  </div>
                </div>
              </Section>

              <Section
                icon={MapPinIcon}
                title="Addresses"
                description="Billing, shipping and other locations; mark one as the default"
                action={
                  !addressDraft && (
                    <button
                      type="button"
                      onClick={() => openAddress(null)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add address
                    </button>
                  )
                }
              >
                {addressDraft && (
                  <div className="mb-5 rounded-lg border border-cyan-200 bg-cyan-50/40 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                      {addressDraft.index === null ? "New address" : "Edit address"}
                    </p>
                    <div className="grid gap-x-4 md:grid-cols-2">
                      <FloatingSelect
                        label="Address type"
                        value={addressDraft.value.type}
                        onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, type: e.target.value } })}
                        options={ADDRESS_TYPES.map((t) => ({ id: t.id, name: t.name }))}
                        includeEmptyOption={false}
                      />
                      <div className="hidden md:block" />
                      <div className="md:col-span-2">
                        <FloatingInput
                          label="Address line 1"
                          required
                          value={addressDraft.value.addressLine1}
                          error={addressErrors.addressLine1}
                          onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, addressLine1: e.target.value } })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FloatingInput
                          label="Address line 2"
                          value={addressDraft.value.addressLine2 ?? ""}
                          onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, addressLine2: e.target.value } })}
                        />
                      </div>
                      <FloatingInput
                        label="City"
                        required
                        value={addressDraft.value.city}
                        error={addressErrors.city}
                        onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, city: e.target.value } })}
                      />
                      <FloatingInput
                        label="State"
                        required
                        value={addressDraft.value.state}
                        error={addressErrors.state}
                        onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, state: e.target.value } })}
                      />
                      <FloatingInput
                        label="Postal code"
                        value={addressDraft.value.postalCode}
                        onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, postalCode: e.target.value } })}
                      />
                      <FloatingInput
                        label="Country"
                        required
                        value={addressDraft.value.country}
                        error={addressErrors.country}
                        onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, country: e.target.value } })}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={addressDraft.value.defaultAddress}
                          onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, defaultAddress: e.target.checked } })}
                          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        Default address
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAddressDraft(null)}
                          className="h-8 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveAddress}
                          className="h-8 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-700"
                        >
                          {addressDraft.index === null ? "Add address" : "Update address"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {form.addresses.length === 0 && !addressDraft ? (
                  <button
                    type="button"
                    onClick={() => openAddress(null)}
                    className="mb-5 flex w-full flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-8 text-center hover:border-cyan-300 hover:bg-cyan-50/30 dark:border-gray-700 dark:hover:border-cyan-800"
                  >
                    <MapPinIcon className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">No addresses yet</span>
                    <span className="text-xs text-cyan-700 dark:text-cyan-400">Add the billing address</span>
                  </button>
                ) : (
                  <div className="mb-5 grid gap-3 md:grid-cols-2">
                    {form.addresses.map((address, index) => {
                      const type = ADDRESS_TYPES.find((t) => t.id === address.type) ?? ADDRESS_TYPES[5];
                      const TypeIcon = type.icon;
                      const editing = addressDraft?.index === index;
                      return (
                        <div
                          key={address.id ?? `new-${index}`}
                          className={`rounded-lg border p-4 ${
                            editing
                              ? "border-cyan-300 opacity-50"
                              : address.defaultAddress
                              ? "border-cyan-300 bg-cyan-50/30 dark:border-cyan-800 dark:bg-cyan-950/10"
                              : "border-gray-200 dark:border-gray-800"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                              <TypeIcon className="h-4 w-4 text-cyan-600" />
                              {type.name}
                              {address.defaultAddress && (
                                <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white">
                                  Default
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-0.5">
                              {!address.defaultAddress && (
                                <button
                                  type="button"
                                  title="Make default"
                                  onClick={() => makeDefault(index)}
                                  className="rounded-md p-1.5 text-gray-400 hover:bg-cyan-50 hover:text-cyan-700"
                                >
                                  <StarIcon className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                title="Edit address"
                                onClick={() => openAddress(index)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Remove address"
                                onClick={() => removeAddress(index)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{address.addressLine1}</p>
                          {address.addressLine2 && <p className="text-sm text-gray-600 dark:text-gray-400">{address.addressLine2}</p>}
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{address.country}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* ---------------- right: how we sell to them ---------------- */}
            <div className="space-y-4">
              <Section icon={WalletIcon} title="Sales & billing" description="Sales person, payment terms, currency and credit">
                {salesPersons !== null && (
                  <>
                    <FloatingSelect
                      label="Sales person"
                      name="salesPersonId"
                      value={form.salesPersonId}
                      onChange={(e) => update("salesPersonId", e.target.value)}
                      options={salesPersonOptions}
                    />
                    {salesPersonOptions.length === 0 && <Hint>Add sales persons in Sales → Sales Persons.</Hint>}
                  </>
                )}
                <FloatingSelect
                  label="Payment terms"
                  name="paymentTerms"
                  value={form.paymentTerms}
                  onChange={(e) => update("paymentTerms", e.target.value)}
                  options={paymentTermOptions}
                />
                <FloatingSelect
                  label="Currency"
                  name="currencyCode"
                  value={form.currencyCode}
                  onChange={(e) => update("currencyCode", e.target.value)}
                  options={currencySelectOptions}
                  includeEmptyOption={false}
                />
                <FloatingInput
                  label="Credit limit"
                  name="creditLimit"
                  type="number"
                  min={0}
                  value={form.creditLimit}
                  error={errors.creditLimit}
                  onChange={(e) => update("creditLimit", e.target.value)}
                />
                <Hint>
                  {form.creditLimit === ""
                    ? "Leave blank for no limit — orders aren't checked against credit."
                    : Number(form.creditLimit) === 0
                    ? "A limit of 0 blocks every order on credit."
                    : `Orders are checked against ${formatMoney(Number(form.creditLimit), form.currencyCode || companyCurrency())}.`}
                </Hint>
              </Section>

              {isEditing ? (
                <Section icon={BriefcaseIcon} title="Account" description="Kept up to date by Sales">
                  <dl className="mb-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500 dark:text-gray-400">Customer code</dt>
                      <dd className="font-mono text-gray-900 dark:text-gray-100">{salesFigures.customerCode ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500 dark:text-gray-400">Outstanding balance</dt>
                      <dd className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatMoney(salesFigures.outstandingBalance, form.currencyCode || companyCurrency())}
                      </dd>
                    </div>
                  </dl>
                </Section>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  The customer code is assigned automatically when you create the customer. Add contact people afterwards under
                  CRM → Key Contacts.
                </p>
              )}
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        isOpen={confirmLeave}
        variant="warning"
        title="Discard changes?"
        message="You have unsaved changes to this customer. Leave without saving?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          navigate("/customer-management");
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
};

export default CustomerFormPage;
