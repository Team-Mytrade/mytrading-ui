import PurchaseResourcePage, { PurchaseResourceConfig } from "../Purchase/PurchaseResourcePage";
import { INDIAN_STATE_OPTIONS, normalizePhone, toStateName, validateVendorForm } from "../../utils/indiaValidators";
import { companyCurrency, currencyChoices } from "../../company/format";

const VENDORS = "/v1/api/common/vendors";

const PAYMENT_TERMS = ["Due on Receipt", "Advance Payment", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];

/** Trimmed string, or null when empty (so the API stores NULL instead of ""). */
const text = (value: unknown): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** Upper-cased value with all spaces removed. Used for GST, PAN, IFSC and currency. */
const code = (value: unknown): string | null => text(value)?.replace(/\s+/g, "").toUpperCase() ?? null;

/** Digit-style values (PIN code, bank account): spaces removed. */
const compact = (value: unknown): string | null => text(value)?.replace(/\s+/g, "") ?? null;

/** Lower-cased email, or null when empty. */
const email = (value: unknown): string | null => text(value)?.toLowerCase() ?? null;

/**
 * Vendor code in one clean format: upper-case, spaces/underscores become hyphens,
 * repeated hyphens collapse to one, no hyphen at the start or end.
 * e.g. "ven--05" -> "VEN-05", " abc sup 1 " -> "ABC-SUP-1"
 */
const vendorCode = (value: unknown): string | null => {
  const cleaned = text(value)
    ?.toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned ? cleaned : null;
};

/** Vendor master (owned by the common service; Purchase and Finance share it). */
const vendorConfig: PurchaseResourceConfig = {
  title: "Vendors",
  formSubtitle: "Add or update a supplier record.",
  description: "Manage the vendors Purchase and Finance use.",
  endpoint: VENDORS,
  getByIdEndpoint: (row) => `${VENDORS}/${row.id}`,
  // Opened from a link (e.g. vendor name in a PO): show only that vendor.
  scope: { idParam: "vendorId", nameParam: "vendorName", label: "Vendor" },
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
    { name: "vendorCode", section: "Basic Details", label: "Vendor Code (e.g. VEN-001)", required: true, readOnlyOnEdit: true, textCase: "upper", maxLength: 20 },
    { name: "name", section: "Basic Details", label: "Vendor Name", required: true, textCase: "title", maxLength: 100 },
    { name: "legalName", section: "Basic Details", label: "Legal Name (registered company name)", textCase: "title", maxLength: 150, gridClassName: "md:col-span-2" },
    { name: "contactName", section: "Contact", label: "Contact Person", textCase: "title", maxLength: 60 },
    { name: "contactEmail", section: "Contact", label: "Contact Email", type: "email", textCase: "lower", maxLength: 100 },
    { name: "contactPhone", section: "Contact", label: "Contact Phone", type: "tel", maxLength: 16 },
    { name: "website", section: "Contact", label: "Website" },
    // Address comes before Tax: the GST number must belong to the state chosen here.
    // Order goes from big to small: Country → State → City → PIN → street address,
    // because the State list and the GST/PIN checks depend on the country and state.
    { name: "country", section: "Address", label: "Country", textCase: "title", maxLength: 60 },
    {
      name: "state", section: "Address",
      label: "State",
      type: "select",
      searchable: true, // type "t" → Tamil Nadu, Telangana, Tripura
      placeholder: "Type state name, e.g. Tamil",
      options: INDIAN_STATE_OPTIONS,
    },
    { name: "city", section: "Address", label: "City", textCase: "title", maxLength: 60 },
    { name: "postalCode", section: "Address", label: "PIN Code", maxLength: 6 },
    { name: "address", section: "Address", label: "Address (building, street, area)", type: "textarea", gridClassName: "md:col-span-2" },
    // Terms first (Currency, Payment Terms), then tax IDs: two rows of two.
    {
      name: "currency", section: "Terms & Tax",
      label: "Currency",
      type: "select",
      placeholderOption: "Select Currency",
      // Read when the form opens: the company's currency first
      get options() {
        return currencyChoices().map((value) => ({ value, label: value }));
      },
    },
    {
      name: "paymentTerms", section: "Terms & Tax",
      label: "Payment Terms",
      type: "select",
      placeholderOption: "Select Payment Terms",
      options: PAYMENT_TERMS.map((value) => ({ value, label: value })),
    },
    {
      name: "gstNumber", section: "Terms & Tax",
      label: "GSTIN (e.g. 33ABCDE1234F1Z7)",
      textCase: "upper",
      maxLength: 15,
      // A GSTIN contains the PAN (characters 3–12), so a full GSTIN fills PAN by itself.
      onValueChange: (value) => {
        const gst = String(value ?? "").toUpperCase();
        return gst.length === 15 ? { panNumber: gst.slice(2, 12) } : undefined;
      },
    },
    { name: "panNumber", section: "Terms & Tax", label: "PAN (filled from GSTIN)", textCase: "upper", maxLength: 10 },
    { name: "bankName", section: "Bank Details", label: "Bank Name", textCase: "title", maxLength: 100 },
    { name: "bankAccountNumber", section: "Bank Details", label: "Bank Account Number", maxLength: 18 },
    { name: "bankIfscCode", section: "Bank Details", label: "Bank IFSC Code (e.g. HDFC0001234)", textCase: "upper", maxLength: 11 },
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
    currency: companyCurrency(),
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

  // Older records saved "TN", "KL"… — show them as the full state name so the dropdown selects it.
  normalizeForm: (row) => ({ ...row, state: toStateName(row.state) }),

  // Errors are shown under each field and on its tab (red dot); Save jumps to the first tab with an error.
  // Indian formats (GST, PAN, PIN, IFSC, phone, bank account) are checked only when Country is India.
  // The vendor code is read-only on edit, so it is only checked when creating.
  validateFields: (form, editingRow) => validateVendorForm(form, { checkVendorCode: !editingRow }),

  // Only business fields are sent. id, tenantId, createdBy, createdDate and
  // updatedDate are set by the server (tenant comes from the JWT / X-Tenant-ID).
  buildPayload: (form, editingRow) => {
    const isIndia = ["", "india"].includes(String(form.country ?? "").trim().toLowerCase());

    return {
      // Vendor code is entered on create and stays the same when editing,
      // because POs and GRNs refer to it.
      vendorCode: editingRow ? editingRow.vendorCode : vendorCode(form.vendorCode),
      name: text(form.name),
      legalName: text(form.legalName),
      contactName: text(form.contactName),
      contactEmail: email(form.contactEmail),
      // Indian numbers are saved in one format: +91XXXXXXXXXX.
      contactPhone: isIndia ? normalizePhone(form.contactPhone) : text(form.contactPhone),
      website: text(form.website),
      gstNumber: code(form.gstNumber),
      panNumber: code(form.panNumber),
      paymentTerms: text(form.paymentTerms),
      currency: code(form.currency),
      address: text(form.address),
      city: text(form.city),
      state: text(toStateName(form.state)),
      postalCode: compact(form.postalCode),
      country: text(form.country),
      bankName: text(form.bankName),
      bankAccountNumber: compact(form.bankAccountNumber),
      bankIfscCode: code(form.bankIfscCode),
      // New vendor: active. Edit form: keeps the current status (form.active comes from the record).
      // Status dropdown in the table: sends the new value chosen there.
      active: form.active === undefined ? true : Boolean(form.active),
    };
  },
};

export default function Vendors() {
  return <PurchaseResourcePage config={vendorConfig} />;
}
