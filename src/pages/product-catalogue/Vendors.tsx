import PurchaseResourcePage, { PurchaseResourceConfig } from "../Purchase/PurchaseResourcePage";
import { INDIAN_STATE_OPTIONS, normalizePhone, toStateName, validateVendorForm } from "../../utils/indiaValidators";
import { companyCurrency, currencyChoices } from "../../company/format";
import {
  DEFAULT_PAYMENT_TERM, PAYMENT_TERMS_API, STANDARD_PAYMENT_TERMS, paymentTermLabel, withStoredTerm,
} from "../../utils/paymentTerms";

const VENDORS = "/v1/api/common/vendors";


/** Trimmed string, or null when empty (so the API stores NULL instead of ""). */
const text = (value: unknown): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

import { currentCompanyCountry } from "../../company/companyApi";
import { findCountry } from "../../company/regional";
import { UAE_EMIRATES, SAUDI_REGIONS } from "../../company/regionalAddress";

const isIndianAddress = (form: Record<string, unknown>) => ["", "india"].includes(String(form.country ?? "").trim().toLowerCase());

/** The vendor's country as an ISO code ("IN" when blank or India; "AE" for UAE...). */
const vendorIso = (form: Record<string, unknown>): string => {
  const name = String(form.country ?? "").trim();
  if (!name || name.toLowerCase() === "india") return "IN";
  const alias: Record<string, string> = { uae: "AE", "u.a.e": "AE", ksa: "SA" };
  return alias[name.toLowerCase()] ?? findCountry(name)?.isoCode ?? name.toUpperCase();
};

/** What a vendor's tax registration is called in its country. */
const taxIdLabel = (iso: string) =>
  iso === "IN" ? "GSTIN" : iso === "SA" ? "VAT Number" : ["AE", "BH", "OM"].includes(iso) ? "TRN (VAT)" : "Tax Registration Number";

/** Labels that differ by the vendor's country (form and details drawer). */
const vendorLabels = (row: Record<string, unknown>): Record<string, string> => {
  const iso = vendorIso(row);
  return iso === "IN"
    ? { gstNumber: "GSTIN", panNumber: "PAN", bankAccountNumber: "Bank Account Number", bankIfscCode: "IFSC Code", state: "State", postalCode: "PIN Code" }
    : {
        gstNumber: taxIdLabel(iso),
        bankAccountNumber: "IBAN",
        bankIfscCode: "SWIFT / BIC Code",
        state: iso === "AE" ? "Emirate" : iso === "SA" ? "Region" : "State / Region",
        postalCode: iso === "AE" ? "P.O. Box" : "Postal Code",
      };
};

/** Checks for vendors outside India: TRN / VAT number format, IBAN and SWIFT. */
const foreignVendorErrors = (form: Record<string, unknown>): Record<string, string> => {
  const iso = vendorIso(form);
  if (iso === "IN") return {};
  const errors: Record<string, string> = {};
  const tax = String(form.gstNumber ?? "").replace(/\s+/g, "").toUpperCase();
  if (tax && iso === "AE" && !/^100\d{12}$/.test(tax)) errors.gstNumber = "A UAE TRN is 15 digits starting with 100";
  else if (tax && iso === "SA" && !/^3\d{13}3$/.test(tax)) errors.gstNumber = "A Saudi VAT number is 15 digits that start and end with 3";
  const iban = String(form.bankAccountNumber ?? "").replace(/\s+/g, "").toUpperCase();
  if (iban && iso === "AE" && !/^AE\d{21}$/.test(iban)) errors.bankAccountNumber = "A UAE IBAN is AE followed by 21 digits (23 characters)";
  else if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) errors.bankAccountNumber = "Enter the IBAN: 2 letters, 2 digits, then up to 30 letters or digits";
  const swift = String(form.bankIfscCode ?? "").replace(/\s+/g, "").toUpperCase();
  if (swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) errors.bankIfscCode = "A SWIFT / BIC code is 8 or 11 letters and digits";
  return errors;
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
      // India: the state list; UAE: the 7 emirates; Saudi Arabia: its regions; elsewhere typed
      adapt: (form) => {
        if (isIndianAddress(form)) return {};
        const iso = vendorIso(form);
        if (iso === "AE" || iso === "SA") {
          const names = iso === "AE" ? UAE_EMIRATES : SAUDI_REGIONS;
          return { label: iso === "AE" ? "Emirate" : "Region", placeholder: "", searchable: false, options: names.map((value) => ({ value, label: value })) };
        }
        return { type: "text", label: "State / Region", placeholder: "", searchable: false, options: undefined, textCase: "title", maxLength: 60 };
      },
    },
    { name: "city", section: "Address", label: "City", textCase: "title", maxLength: 60 },
    {
      name: "postalCode", section: "Address", label: "PIN Code", maxLength: 6,
      adapt: (form) => (isIndianAddress(form) ? {} : { label: vendorIso(form) === "AE" ? "P.O. Box" : "Postal Code", maxLength: 12 }),
    },
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
      // The company's terms (Invoice → Payment Terms), saved by code like customers' (NET30, TEST-75...)
      optionsEndpoint: PAYMENT_TERMS_API,
      optionValue: "termCode",
      optionLabel: (row) => paymentTermLabel(row as { termCode?: string; description?: string; dueDays?: number }),
      // The standard terms when the list can't be read; a stored value that isn't listed ("30 Days") is kept
      getOptions: ({ form, options }) => {
        const loaded = (options.paymentTerms ?? []).map((o) => ({ id: String(o.value), name: o.label }));
        return withStoredTerm(loaded.length ? loaded : STANDARD_PAYMENT_TERMS, String(form.paymentTerms ?? ""))
          .map((o) => ({ value: o.id, label: o.name }));
      },
    },
    {
      // Indian vendors: GSTIN (checked when Country is India); Gulf vendors: VAT TRN, for input VAT on their bills
      name: "gstNumber", section: "Terms & Tax",
      label: "GSTIN",
      textCase: "upper",
      maxLength: 20,
      adapt: (form) => ({ label: taxIdLabel(vendorIso(form)) }),
      // A GSTIN contains the PAN (characters 3–12), so a full GSTIN fills PAN by itself (not a 15-digit UAE TRN)
      onValueChange: (value) => {
        const gst = String(value ?? "").toUpperCase();
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/.test(gst) && gst.length === 15 ? { panNumber: gst.slice(2, 12) } : undefined;
      },
    },
    // PAN and IFSC are Indian: outside India the PAN is hidden, and the bank fields are the IBAN and SWIFT code
    {
      name: "panNumber", section: "Terms & Tax", label: "PAN (filled from GSTIN)", textCase: "upper", maxLength: 10,
      adapt: (form) => (vendorIso(form) === "IN" ? {} : { gridClassName: "hidden" }),
    },
    { name: "bankName", section: "Bank Details", label: "Bank Name", textCase: "title", maxLength: 100 },
    {
      name: "bankAccountNumber", section: "Bank Details", label: "Bank Account Number", maxLength: 18,
      // An IBAN is up to 34 characters (a UAE IBAN is 23)
      adapt: (form) => (vendorIso(form) === "IN" ? {} : { label: vendorIso(form) === "AE" ? "IBAN (e.g. AE07 0331 2345 6789 0123 456)" : "IBAN", textCase: "upper", maxLength: 42 }),
    },
    {
      name: "bankIfscCode", section: "Bank Details", label: "Bank IFSC Code (e.g. HDFC0001234)", textCase: "upper", maxLength: 11,
      adapt: (form) => (vendorIso(form) === "IN" ? {} : { label: "SWIFT / BIC Code (e.g. EBILAEAD)" }),
    },
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
    paymentTerms: DEFAULT_PAYMENT_TERM,
    currency: companyCurrency(),
    address: "",
    city: "",
    state: "",
    postalCode: "",
    // New vendors start in the company's country
    get country() {
      return currentCompanyCountry() || "India";
    },
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
  validateFields: (form, editingRow) => ({ ...validateVendorForm(form, { checkVendorCode: !editingRow }), ...foreignVendorErrors(form) }),

  // The drawer is titled with the vendor and labels its fields the way the vendor's country does
  detailsTitle: (row) => String(row.name || row.vendorCode || "Vendor"),
  detailsSubtitle: "Vendor details",
  // The same values under country-neutral names (shown once, under the vendor's country's labels)
  hiddenDetailKeys: ["taxNumber", "bankCode"],
  detailLabels: vendorLabels,

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
      // PAN is Indian only
      panNumber: isIndia ? code(form.panNumber) : null,
      paymentTerms: text(form.paymentTerms),
      currency: code(form.currency),
      address: text(form.address),
      city: text(form.city),
      state: text(toStateName(form.state)),
      postalCode: compact(form.postalCode),
      country: text(form.country),
      bankName: text(form.bankName),
      bankAccountNumber: isIndia ? compact(form.bankAccountNumber) : code(form.bankAccountNumber),
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
