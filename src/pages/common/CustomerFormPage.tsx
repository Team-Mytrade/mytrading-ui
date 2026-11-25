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
  IdentificationIcon,
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
import { useCompany } from "../../company/companyApi";
import { addressStyle, regionalAddressErrors, regionalAddressLines } from "../../company/regionalAddress";
import RegionalAddressFields from "../../components/common/RegionalAddressFields";

import { language, t } from "../../i18n/i18n";
import { limitPhoneInput, phoneProblem } from "../../utils/phone";
import {
  CUSTOM_PAYMENT_TERM,
  PAYMENT_TERM_MAX_LENGTH,
  usePaymentTermOptions,
  withAdvanceTerms,
} from "../../utils/paymentTerms";
import {
  ContactRow,
  PAYMENT_MODE_OPTIONS,
  PaymentMode,
  cleanRegistration,
  contactRowsOf,
  countryDefinition,
  countryFieldProblem,
  useCustomerFormOptions,
  type CustomerFormOptions,
} from "./customerProfile";
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


// "AED — UAE Dirham" (named in the screen language): the company's currency first, then Gulf, INR and major currencies
const currencyNames = () => {
  try {
    return new Intl.DisplayNames([language()], { type: "currency" });
  } catch {
    return null;
  }
};
const currencyOptions = (stored?: string) => {
  const names = currencyNames();
  return currencyChoices(stored).map((code) => ({ id: code, name: `${code} — ${names?.of(code) ?? code}` }));
};

const ADDRESS_TYPES = [
  { id: "BILLING", name: "Billing", icon: HomeIcon },
  { id: "SHIPPING", name: "Shipping", icon: TruckIcon },
  { id: "OFFICE", name: "Office", icon: BuildingOfficeIcon },
  { id: "WAREHOUSE", name: "Warehouse", icon: BuildingStorefrontIcon },
  { id: "BRANCH", name: "Branch", icon: BriefcaseIcon },
  { id: "OTHER", name: "Other", icon: MapPinIcon },
];

// Same patterns the service validates with (phone: utils/phone, UAE numbers by their real lengths)
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
  // The country whose tax / registration fields the customer has; "" = from the default address or the company
  taxCountry: string;
  taxNumber: string;
  registrationNumber: string;
  // The country's other values by field key (an Indian PAN as "pan")
  registrationDetails: Record<string, string>;
  // One of each is primary; it is also sent as email / phone, which quotations, orders and messaging read
  emails: ContactRow[];
  phones: ContactRow[];
  website: string;
  paymentMode: PaymentMode;
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

// Field name, or "emails.1", "registrationDetails.pan"...
type Errors = Record<string, string>;

const EMPTY_FORM: CustomerForm = {
  customerName: "",
  tradeName: "",
  customerType: "WHOLESALE",
  status: "ACTIVE",
  taxCountry: "",
  taxNumber: "",
  registrationNumber: "",
  registrationDetails: {},
  emails: [{ value: "", label: "", primary: true }],
  phones: [{ value: "", label: "", primary: true }],
  website: "",
  paymentMode: "CREDIT",
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

/** The tax country: the one chosen, else the default address's (or first address's), else the company's. */
const taxCountryOf = (form: CustomerForm, options: CustomerFormOptions, companyCountry?: string | null) => {
  if (form.taxCountry) return countryDefinition(options, form.taxCountry);
  const address = form.addresses.find((a) => a.defaultAddress) ?? form.addresses[0];
  return countryDefinition(options, (address?.country || companyCountry || "").trim());
};

const fieldValue = (form: CustomerForm, key: string, target: string) =>
  target === "TAX_NUMBER" ? form.taxNumber : target === "REGISTRATION_NUMBER" ? form.registrationNumber : form.registrationDetails[key] ?? "";

const fieldErrorKey = (key: string, target: string) => (target === "DETAIL" ? `registrationDetails.${key}` : key);

const filled = (rows: ContactRow[]) => rows.filter((r) => r.value.trim());

// The form always shows at least one row to type into
const withOneRow = (rows: ContactRow[]): ContactRow[] => (rows.length ? rows : [{ value: "", label: "", primary: true }]);

/** Each row valid and listed once; at least one (the service applies the same rules). */
const contactErrors = (
  rows: ContactRow[],
  field: "emails" | "phones",
  problemOf: (value: string) => string | null
): Errors => {
  const errors: Errors = {};
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const value = row.value.trim();
    if (!value) return;
    const problem = problemOf(value);
    const key = value.replace(/\s+/g, "").toLowerCase();
    if (problem) errors[`${field}.${index}`] = problem;
    else if (seen.has(key)) errors[`${field}.${index}`] = "Listed twice";
    seen.add(key);
  });
  if (!filled(rows).length) errors[`${field}.0`] = field === "emails" ? "Email is required" : "Phone is required";
  return errors;
};

const validate = (form: CustomerForm, options: CustomerFormOptions, companyCountry?: string | null): Errors => {
  const errors: Errors = {};
  for (const field of taxCountryOf(form, options, companyCountry).fields) {
    const problem = countryFieldProblem(field, fieldValue(form, field.key, field.target));
    if (problem) errors[fieldErrorKey(field.key, field.target)] = problem;
  }
  if (!form.customerName.trim()) errors.customerName = "Customer name is required";
  if (!form.customerType) errors.customerType = "Choose the customer type";
  Object.assign(
    errors,
    contactErrors(form.emails, "emails", (v) => (EMAIL_PATTERN.test(v) ? null : "Enter a valid email address")),
    contactErrors(form.phones, "phones", (v) => phoneProblem(v) || null)
  );
  if (form.paymentTerms.trim().length > PAYMENT_TERM_MAX_LENGTH)
    errors.paymentTerms = `Keep the payment terms to ${PAYMENT_TERM_MAX_LENGTH} characters`;
  if (form.paymentMode === "CREDIT" && form.creditLimit !== "" && (Number.isNaN(Number(form.creditLimit)) || Number(form.creditLimit) < 0))
    errors.creditLimit = "Credit limit can't be negative";
  return errors;
};

const validateAddress = (address: Address): Record<string, string> => {
  const style = addressStyle(address.country);
  // UAE: emirate and P.O. Box; Saudi Arabia: the national address (building number, street, district, postal code)
  const errors: Record<string, string> = style === "OTHER" ? {} : regionalAddressErrors(style, address);
  if (style === "OTHER") {
    if (!address.addressLine1.trim()) errors.addressLine1 = "Address is required";
    if (!address.city.trim()) errors.city = "City is required";
    if (!address.state.trim()) errors.state = "State is required";
  }
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
          {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t(description)}</p>}
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

/** Email addresses or phone numbers: one row each, with an optional label; the starred one is primary. */
const ContactList: React.FC<{
  field: "emails" | "phones";
  rows: ContactRow[];
  errors: Errors;
  onChange: (rows: ContactRow[]) => void;
}> = ({ field, rows, errors, onChange }) => {
  const isEmail = field === "emails";
  // Rows the user has left: their format problem shows straight away instead of waiting for Save
  const [left, setLeft] = useState<Set<number>>(new Set());
  const liveProblem = (row: ContactRow, index: number) => {
    const value = row.value.trim();
    if (!value || !left.has(index)) return undefined;
    return (isEmail ? (EMAIL_PATTERN.test(value) ? null : "Enter a valid email address") : phoneProblem(value)) ?? undefined;
  };
  const setRow = (index: number, patch: Partial<ContactRow>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const makePrimary = (index: number) => onChange(rows.map((r, i) => ({ ...r, primary: i === index })));
  const remove = (index: number) => {
    setLeft(new Set());
    const next = rows.filter((_, i) => i !== index);
    if (next.length && !next.some((r) => r.primary)) next[0] = { ...next[0], primary: true };
    onChange(next.length ? next : [{ value: "", label: "", primary: true }]);
  };
  return (
    <div className="mb-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t(isEmail ? "Email addresses" : "Phone numbers")}
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-start gap-x-2">
          <FloatingInput
            label={t(isEmail ? (row.primary ? "Email (primary)" : "Email") : row.primary ? "Phone (primary)" : "Phone")}
            name={`${field}-${index}`}
            type={isEmail ? "email" : "tel"}
            required={row.primary}
            value={row.value}
            error={errors[`${field}.${index}`] ?? liveProblem(row, index)}
            onChange={(e) => setRow(index, { value: isEmail ? e.target.value : limitPhoneInput(e.target.value) })}
            onBlur={() => setLeft((current) => new Set(current).add(index))}
            inputMode={isEmail ? "email" : "tel"}
            maxLength={isEmail ? 120 : 25}
          />
          <FloatingInput
            label={t("Label")}
            name={`${field}-${index}-label`}
            example={t(isEmail ? "Accounts" : "Mobile")}
            value={row.label ?? ""}
            onChange={(e) => setRow(index, { label: e.target.value })}
            maxLength={50}
          />
          <div className="flex h-11 items-center gap-0.5">
            <button
              type="button"
              title={t(row.primary ? "Primary" : "Make primary")}
              aria-pressed={row.primary}
              onClick={() => makePrimary(index)}
              className={`rounded-md p-1.5 ${row.primary ? "text-amber-500" : "text-gray-400 hover:bg-cyan-50 hover:text-cyan-700"}`}
            >
              <StarIcon className={`h-4 w-4 ${row.primary ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              title={t(isEmail ? "Remove email" : "Remove phone")}
              onClick={() => remove(index)}
              disabled={rows.length === 1 && !row.value}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { value: "", label: "", primary: rows.length === 0 }])}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-400"
      >
        <PlusIcon className="h-4 w-4" />
        {t(isEmail ? "Add email" : "Add phone")}
      </button>
    </div>
  );
};

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
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  // New addresses start in the company's own country
  const { company } = useCompany();
  const formOptions = useCustomerFormOptions();

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
          taxCountry: text(data.taxCountry),
          taxNumber: text(data.taxNumber),
          registrationNumber: text(data.registrationNumber),
          registrationDetails: { ...(data.registrationDetails ?? {}) },
          // Customers saved before the lists come back with their single email / phone
          emails: withOneRow(contactRowsOf(data.emails, data.email)),
          phones: withOneRow(contactRowsOf(data.phones, data.phone)),
          website: text(data.website),
          paymentMode: data.paymentMode === "CASH" ? "CASH" : "CREDIT",
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
      if (submitted) setErrors(validate(next, formOptions, company?.country));
      return next;
    });
  };

  /* ---------------- addresses ---------------- */

  const openAddress = (index: number | null) => {
    setAddressErrors({});
    setAddressDraft({
      index,
      value: index === null
        ? { ...EMPTY_ADDRESS, country: company?.country || EMPTY_ADDRESS.country, defaultAddress: form.addresses.length === 0 }
        : { ...form.addresses[index] },
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
    const problems = validate(form, formOptions, company?.country);
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
    const country = taxCountryOf(form, formOptions, company?.country);
    const contacts = (rows: ContactRow[]) => {
      const list = filled(rows).map((r) => ({ value: r.value.trim(), label: r.label?.trim() || null, primary: r.primary }));
      if (list.length && !list.some((r) => r.primary)) list[0].primary = true;
      return list;
    };
    const emails = contacts(form.emails);
    const phones = contacts(form.phones);
    // Only the chosen country's fields are sent; the tax and registration numbers keep their own columns
    const has = (target: string) => country.fields.some((f) => f.target === target);
    const registrationDetails = Object.fromEntries(
      country.fields
        .filter((f) => f.target === "DETAIL")
        .map((f) => [f.key, cleanRegistration(form.registrationDetails[f.key] ?? "")])
        .filter(([, value]) => value)
    );
    const payload = {
      customerName: form.customerName.trim(),
      tradeName: form.tradeName.trim() || null,
      customerType: form.customerType,
      status: form.status,
      // Same rule as the status dropdown on the customer list
      active: form.status === "ACTIVE",
      taxCountry: country.code,
      taxNumber: has("TAX_NUMBER") ? cleanRegistration(form.taxNumber) || null : null,
      registrationNumber: has("REGISTRATION_NUMBER") ? cleanRegistration(form.registrationNumber) || null : null,
      registrationDetails,
      emails,
      phones,
      email: emails.find((r) => r.primary)?.value ?? null,
      phone: phones.find((r) => r.primary)?.value ?? null,
      website: form.website.trim() || null,
      paymentMode: form.paymentMode,
      salesPersonId: form.salesPersonId ? Number(form.salesPersonId) : null,
      salesPersonName: salesPerson?.name ?? null,
      paymentTerms: form.paymentTerms.trim() || null,
      currencyCode: form.currencyCode || companyCurrency(),
      // Cash customers don't buy on account
      creditLimit: form.paymentMode === "CASH" || form.creditLimit === "" ? null : Number(form.creditLimit),
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

  // The company's terms (Invoice → Payment Terms), plus a stored value that isn't in them (older records used free text)
  const companyPaymentTerms = usePaymentTermOptions();
  // The company's terms, then the advance-payment ones; anything else is a custom term typed by the user
  const paymentTermOptions = useMemo(() => withAdvanceTerms(companyPaymentTerms), [companyPaymentTerms]);
  const [customTermChosen, setCustomTermChosen] = useState(false);
  const isCustomTerm =
    customTermChosen || (form.paymentTerms.trim() !== "" && !paymentTermOptions.some((o) => o.id === form.paymentTerms));
  const paymentTermSelectOptions = useMemo(
    () => [...paymentTermOptions, { id: CUSTOM_PAYMENT_TERM, name: "Custom…" }],
    [paymentTermOptions]
  );
  const choosePaymentTerm = (value: string) => {
    if (value === CUSTOM_PAYMENT_TERM) {
      setCustomTermChosen(true);
      // Start from a blank box rather than a code from the list
      if (paymentTermOptions.some((o) => o.id === form.paymentTerms)) update("paymentTerms", "");
      return;
    }
    setCustomTermChosen(false);
    update("paymentTerms", value);
  };
  // Cash customers pay on receipt: the company's due-on-receipt term when it has one
  const cashTerm = paymentTermOptions.find((o) => o.id === "IMMEDIATE" || /receipt|immediate|cash/i.test(o.name))?.id;
  const setPaymentMode = (mode: PaymentMode) => {
    update("paymentMode", mode);
    if (mode === "CASH" && cashTerm) {
      setCustomTermChosen(false);
      update("paymentTerms", cashTerm);
    }
  };
  const taxCountry = taxCountryOf(form, formOptions, company?.country);
  const countryOptions = formOptions.countries.map((c) => ({ id: c.code, name: c.code === "OTHER" ? "Other country" : c.name }));
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
              {t("Cancel")}
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
              {t(saving ? "Saving…" : isEditing ? "Save changes" : "Create customer")}
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
              <Section icon={BuildingOfficeIcon} title={t("Company")} description="Legal name, type, classification and status">
                <div className="grid gap-x-4 md:grid-cols-2">
                  <FloatingInput
                    label={t("Customer name")}
                    name="customerName"
                    required
                    value={form.customerName}
                    error={errors.customerName}
                    onChange={(e) => update("customerName", e.target.value)}
                    maxLength={150}
                  />
                  <FloatingInput
                    label={t("Trade name")}
                    name="tradeName"
                    value={form.tradeName}
                    onChange={(e) => update("tradeName", e.target.value)}
                    maxLength={150}
                  />
                  <FloatingSelect
                    label={t("Customer type *")}
                    name="customerType"
                    value={form.customerType}
                    onChange={(e) => update("customerType", e.target.value)}
                    options={CUSTOMER_TYPE_OPTIONS}
                    includeEmptyOption={false}
                  />
                  <FloatingSelect
                    label={t("Classification *")}
                    name="paymentMode"
                    value={form.paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    options={PAYMENT_MODE_OPTIONS}
                    includeEmptyOption={false}
                  />
                  <FloatingSelect
                    label={t("Status *")}
                    name="status"
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                    options={STATUS_OPTIONS}
                    includeEmptyOption={false}
                  />
                </div>
              </Section>

              <Section
                icon={IdentificationIcon}
                title={t("Tax & registration")}
                description="The fields the customer's tax country needs"
              >
                <div className="grid gap-x-4 md:grid-cols-2">
                  <FloatingSelect
                    label={t("Tax country")}
                    name="taxCountry"
                    value={taxCountry.code}
                    onChange={(e) => update("taxCountry", e.target.value)}
                    options={countryOptions}
                    includeEmptyOption={false}
                  />
                  {taxCountry.fields.map((field) => {
                    const value = fieldValue(form, field.key, field.target);
                    const onChange = (raw: string) => {
                      const next = raw.toUpperCase();
                      if (field.target === "TAX_NUMBER") update("taxNumber", next);
                      else if (field.target === "REGISTRATION_NUMBER") update("registrationNumber", next);
                      else update("registrationDetails", { ...form.registrationDetails, [field.key]: next });
                    };
                    return (
                      <FloatingInput
                        key={`${taxCountry.code}-${field.key}`}
                        label={t(field.label)}
                        name={field.key}
                        required={field.required}
                        example={field.example ?? undefined}
                        value={value}
                        error={errors[fieldErrorKey(field.key, field.target)]}
                        onChange={(e) => onChange(e.target.value)}
                        maxLength={50}
                      />
                    );
                  })}
                </div>
              </Section>

              <Section icon={EnvelopeIcon} title={t("Contact details")} description="The company's email addresses and phone numbers; the starred one is used on quotations, orders, invoices and messages. People go under Key Contacts">
                <div className="grid gap-x-6 lg:grid-cols-2">
                  <ContactList field="emails" rows={form.emails} errors={errors} onChange={(rows) => update("emails", rows)} />
                  <ContactList field="phones" rows={form.phones} errors={errors} onChange={(rows) => update("phones", rows)} />
                </div>
                <div className="grid gap-x-4 md:grid-cols-2">
                  <div>
                    <FloatingInput
                      label={t("Website")}
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
                title={t("Addresses")}
                description="Billing, shipping and other locations; mark one as the default"
                action={
                  !addressDraft && (
                    <button
                      type="button"
                      onClick={() => openAddress(null)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t("Add address")}
                    </button>
                  )
                }
              >
                {addressDraft && (
                  <div className="mb-5 rounded-lg border border-cyan-200 bg-cyan-50/40 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                      {t(addressDraft.index === null ? "New address" : "Edit address")}
                    </p>
                    <div className="grid gap-x-4 md:grid-cols-2">
                      <FloatingSelect
                        label={t("Address type")}
                        value={addressDraft.value.type}
                        onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, type: e.target.value } })}
                        options={ADDRESS_TYPES.map((t) => ({ id: t.id, name: t.name }))}
                        includeEmptyOption={false}
                      />
                      {/* The country first: the UAE and Saudi Arabia have their own address fields */}
                      <FloatingInput
                        label={t("Country")}
                        required
                        value={addressDraft.value.country}
                        error={addressErrors.country}
                        onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, country: e.target.value } })}
                      />
                      {addressStyle(addressDraft.value.country) !== "OTHER" ? (
                        <RegionalAddressFields
                          style={addressStyle(addressDraft.value.country) as "AE" | "SA"}
                          idPrefix="customer-address"
                          value={addressDraft.value}
                          errors={addressErrors}
                          fieldClass="mb-3"
                          labelClass="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
                          inputClass="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          errorClass="error-text"
                          onChange={(patch) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, ...patch } })}
                        />
                      ) : (
                        <>
                          <div className="md:col-span-2">
                            <FloatingInput
                              label={t("Address line 1")}
                              required
                              value={addressDraft.value.addressLine1}
                              error={addressErrors.addressLine1}
                              onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, addressLine1: e.target.value } })}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <FloatingInput
                              label={t("Address line 2")}
                              value={addressDraft.value.addressLine2 ?? ""}
                              onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, addressLine2: e.target.value } })}
                            />
                          </div>
                          <FloatingInput
                            label={t("City")}
                            required
                            value={addressDraft.value.city}
                            error={addressErrors.city}
                            onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, city: e.target.value } })}
                          />
                          <FloatingInput
                            label={t("State")}
                            required
                            value={addressDraft.value.state}
                            error={addressErrors.state}
                            onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, state: e.target.value } })}
                          />
                          <FloatingInput
                            label={t("Postal code")}
                            value={addressDraft.value.postalCode}
                            onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, postalCode: e.target.value } })}
                          />
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={addressDraft.value.defaultAddress}
                          onChange={(e) => setAddressDraft({ ...addressDraft, value: { ...addressDraft.value, defaultAddress: e.target.checked } })}
                          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        {t("Default address")}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAddressDraft(null)}
                          className="h-8 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                          {t("Cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={saveAddress}
                          className="h-8 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-700"
                        >
                          {t(addressDraft.index === null ? "Add address" : "Update address")}
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
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t("No addresses yet")}</span>
                    <span className="text-xs text-cyan-700 dark:text-cyan-400">{t("Add the billing address")}</span>
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
                                  {t("Default")}
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-0.5">
                              {!address.defaultAddress && (
                                <button
                                  type="button"
                                  title={t("Make default")}
                                  onClick={() => makeDefault(index)}
                                  className="rounded-md p-1.5 text-gray-400 hover:bg-cyan-50 hover:text-cyan-700"
                                >
                                  <StarIcon className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                title={t("Edit address")}
                                onClick={() => openAddress(index)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title={t("Remove address")}
                                onClick={() => removeAddress(index)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {addressStyle(address.country) !== "OTHER" ? (
                            regionalAddressLines(address).map((line, i) => (
                              <p key={i} className={`text-sm ${i === 0 ? "text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`}>{line}</p>
                            ))
                          ) : (
                            <>
                              <p className="text-sm text-gray-800 dark:text-gray-200">{address.addressLine1}</p>
                              {address.addressLine2 && <p className="text-sm text-gray-600 dark:text-gray-400">{address.addressLine2}</p>}
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{address.country}</p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* ---------------- right: how we sell to them ---------------- */}
            <div className="space-y-4">
              <Section icon={WalletIcon} title={t("Sales & billing")} description="Cash or credit, sales person, payment terms and currency">
                {/* Cash / Credit is the customer's classification, chosen in the Company section */}
                <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <span className="font-semibold">{t(form.paymentMode === "CASH" ? "Cash customer" : "Credit customer")}</span>
                  {" — "}
                  {t(form.paymentMode === "CASH" ? "Pays on the spot; no credit limit." : "Buys on account within the credit limit and credit days.")}
                </p>
                {salesPersons !== null && (
                  <>
                    <FloatingSelect
                      label={t("Sales person")}
                      name="salesPersonId"
                      value={form.salesPersonId}
                      onChange={(e) => update("salesPersonId", e.target.value)}
                      options={salesPersonOptions}
                    />
                    {salesPersonOptions.length === 0 && <Hint>{t("Add sales persons in Sales → Sales Persons.")}</Hint>}
                  </>
                )}
                <FloatingSelect
                  label={t(form.paymentMode === "CREDIT" ? "Credit days (payment terms)" : "Payment terms")}
                  name="paymentTerms"
                  value={isCustomTerm ? CUSTOM_PAYMENT_TERM : form.paymentTerms}
                  onChange={(e) => choosePaymentTerm(e.target.value)}
                  options={paymentTermSelectOptions}
                />
                {isCustomTerm && (
                  <FloatingInput
                    label={t("Custom payment terms")}
                    name="customPaymentTerms"
                    example={t("e.g. 30% advance, 70% on delivery")}
                    value={form.paymentTerms}
                    error={errors.paymentTerms}
                    onChange={(e) => update("paymentTerms", e.target.value)}
                    maxLength={PAYMENT_TERM_MAX_LENGTH}
                  />
                )}
                <FloatingSelect
                  label={t("Currency")}
                  name="currencyCode"
                  value={form.currencyCode}
                  onChange={(e) => update("currencyCode", e.target.value)}
                  options={currencySelectOptions}
                  includeEmptyOption={false}
                />
                {form.paymentMode === "CREDIT" && (
                  <>
                    <FloatingInput
                      label={t("Credit limit")}
                      name="creditLimit"
                      type="number"
                      min={0}
                      value={form.creditLimit}
                      error={errors.creditLimit}
                      onChange={(e) => update("creditLimit", e.target.value)}
                    />
                    <Hint>
                      {form.creditLimit === "" ? t("Leave blank for no limit — orders aren't checked against credit.") : Number(form.creditLimit) === 0 ? t("A limit of 0 blocks every order on credit.") : t("Orders are checked against {amount}.", { amount: formatMoney(Number(form.creditLimit), form.currencyCode || companyCurrency()) })}
                    </Hint>
                  </>
                )}
              </Section>

              {isEditing ? (
                <Section icon={BriefcaseIcon} title={t("Account")} description="Kept up to date by Sales">
                  <dl className="mb-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500 dark:text-gray-400">{t("Customer code")}</dt>
                      <dd className="font-mono text-gray-900 dark:text-gray-100">{salesFigures.customerCode ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500 dark:text-gray-400">{t("Outstanding balance")}</dt>
                      <dd className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatMoney(salesFigures.outstandingBalance, form.currencyCode || companyCurrency())}
                      </dd>
                    </div>
                  </dl>
                </Section>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  {t("The customer code is assigned automatically when you create the customer. Add contact people afterwards under CRM → Key Contacts.")}
                </p>
              )}
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        isOpen={confirmLeave}
        variant="warning"
        title={t("Discard changes?")}
        message="You have unsaved changes to this customer. Leave without saving?"
        confirmLabel={t("Discard")}
        cancelLabel={t("Keep editing")}
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
