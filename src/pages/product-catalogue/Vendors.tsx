import PurchaseResourcePage, { PurchaseResourceConfig } from "../Purchase/PurchaseResourcePage";

const VENDORS = "/v1/api/product/vendors";

const PAYMENT_TERMS = ["Due on Receipt", "Advance Payment", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD", "JPY"];

/** Trimmed string, or null when empty (so the API stores NULL instead of ""). */
const text = (value: unknown): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** Same as text(), but upper-cased. Used for codes and Indian tax/bank identifiers. */
const code = (value: unknown): string | null => text(value)?.toUpperCase() ?? null;

/** Lower-cased email, or null when empty. */
const email = (value: unknown): string | null => text(value)?.toLowerCase() ?? null;

/** Vendor master (owned by the Product Catalogue service). */
const vendorConfig: PurchaseResourceConfig = {
  title: "Vendors",
  formSubtitle: "Add or update a supplier record.",
  description: "Manage vendors from the Product Catalogue service.",
  endpoint: VENDORS,
  getByIdEndpoint: (row) => `${VENDORS}/${row.id}`,
  allowInlineActiveToggle: true,

  columns: [
    { key: "vendorCode", label: "Vendor Code" },
    { key: "name", label: "Vendor Name" },
    { key: "contactName", label: "Contact" },
    { key: "contactEmail", label: "Email" },
    { key: "contactPhone", label: "Phone" },
    { key: "city", label: "City" },
    { key: "active", label: "Status" },
  ],

  fields: [
    { name: "vendorCode", label: "Vendor Code", required: true },
    { name: "name", label: "Vendor Name", required: true },
    { name: "legalName", label: "Legal Name" },
    { name: "contactName", label: "Contact Name" },
    { name: "contactEmail", label: "Contact Email", type: "email" },
    { name: "contactPhone", label: "Contact Phone", type: "tel" },
    { name: "website", label: "Website" },
    { name: "gstNumber", label: "GST Number" },
    { name: "panNumber", label: "PAN Number" },
    {
      name: "paymentTerms",
      label: "Payment Terms",
      type: "select",
      placeholderOption: "",
      options: PAYMENT_TERMS.map((value) => ({ value, label: value })),
    },
    {
      name: "currency",
      label: "Currency",
      type: "select",
      placeholderOption: "",
      options: CURRENCIES.map((value) => ({ value, label: value })),
    },
    { name: "address", label: "Address", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "city", label: "City" },
    { name: "state", label: "State" },
    { name: "postalCode", label: "Postal Code" },
    { name: "country", label: "Country" },
    { name: "bankName", label: "Bank Name" },
    { name: "bankAccountNumber", label: "Bank Account Number" },
    { name: "bankIfscCode", label: "Bank IFSC Code" },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],

  searchFields: ["vendorCode", "name", "legalName", "contactName", "contactEmail", "city", "country"],

  // A new vendor starts empty; only sensible business defaults are pre-filled.
  initialFormState: {
    vendorCode: "",
    name: "",
    legalName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    gstNumber: "",
    panNumber: "",
    paymentTerms: "30 Days",
    currency: "INR",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    bankName: "",
    bankAccountNumber: "",
    bankIfscCode: "",
    active: true,
  },


  buildPayload: (form, editingRow) => ({
    // Vendor code is the business key: keep the original value when editing.
    vendorCode: editingRow ? editingRow.vendorCode : code(form.vendorCode),
    name: text(form.name),
    legalName: text(form.legalName),
    contactName: text(form.contactName),
    contactEmail: email(form.contactEmail),
    contactPhone: text(form.contactPhone),
    website: text(form.website),
    gstNumber: code(form.gstNumber),
    panNumber: code(form.panNumber),
    paymentTerms: text(form.paymentTerms),
    currency: code(form.currency),
    address: text(form.address),
    city: text(form.city),
    state: text(form.state),
    postalCode: text(form.postalCode),
    country: text(form.country),
    bankName: text(form.bankName),
    bankAccountNumber: text(form.bankAccountNumber),
    bankIfscCode: code(form.bankIfscCode),
    active: Boolean(form.active),
  }),
};

export default function Vendors() {
  return <PurchaseResourcePage config={vendorConfig} />;
}
