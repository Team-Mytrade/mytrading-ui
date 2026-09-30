import PurchaseResourcePage, { PurchaseResourceConfig } from "../Purchase/PurchaseResourcePage";

const VENDORS = "/v1/api/product/vendors";
const PAYMENT_TERMS = ["Due on Receipt", "Advance Payment", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD", "JPY"];

/** Configuration mirrors the Vendor contract from the Product Catalogue service. */
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
  initialFormState: {
    vendorCode: "VEN-001",
    name: "Acme Supply Solutions",
    legalName: "Acme Supply Solutions Private Limited",
    contactName: "Priya Sharma",
    contactEmail: "priya.sharma@acmesupply.example",
    contactPhone: "+91 98765 43210",
    website: "https://www.acmesupply.example",
    gstNumber: "27ABCDE1234F1Z5",
    panNumber: "ABCDE1234F",
    paymentTerms: "30 Days",
    currency: "INR",
    address: "42 Business Park, Andheri East",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400093",
    country: "India",
    bankName: "HDFC Bank",
    bankAccountNumber: "50200012345678",
    bankIfscCode: "HDFC0001234",
    active: true,
  },
  buildPayload: (form, editingRow) => {
    return {
      // The Vendor API accepts this exact request body; IDs and audit values
      // are server-managed and must not be sent from the UI.
      vendorCode: form.vendorCode || editingRow?.vendorCode || "",
      name: form.name || "",
      legalName: form.legalName || "",
      contactName: form.contactName || "",
      contactEmail: form.contactEmail || "",
      contactPhone: form.contactPhone || "",
      website: form.website || "",
      gstNumber: form.gstNumber || "",
      panNumber: form.panNumber || "",
      paymentTerms: form.paymentTerms || "",
      currency: form.currency || "",
      address: form.address || "",
      city: form.city || "",
      state: form.state || "",
      postalCode: form.postalCode || "",
      country: form.country || "",
      bankName: form.bankName || "",
      bankAccountNumber: form.bankAccountNumber || "",
      bankIfscCode: form.bankIfscCode || "",
      active: Boolean(form.active),
    };
  },
};

export default function Vendors() {
  return <PurchaseResourcePage config={vendorConfig} />;
}
