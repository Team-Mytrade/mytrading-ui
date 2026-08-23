import React from "react";
import "./QuotationPreviewTemplate.css";

type Address = {
  customerName?: string;
  customerCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

type SalesPerson = {
  name?: string;
  code?: string;
  email?: string;
  region?: string;
};

type QuotationItem = {
  id: number;
  categoryName?: string;
  itemType?: string;
  productName?: string;
  description?: string;
  productCode?: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  taxRate?: number;
  taxCode?: string;
  remarks?: string;
  additionalDiscount?: number;
};

type Quotation = {
  id: number;
  customerId: number;
  quotationType?: string;
  validUntil?: string;
  currencyCode?: string;
  remarks?: string;
  internalNotes?: string;
  customerNotes?: string;
  subject?: string;
  email?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  items?: QuotationItem[];
  quoteNumber?: string;
  quoteDate?: string;
  status?: string;
  subTotal?: number;
  discountAmount?: number;
  additionalDiscount?: number;
  taxAmount?: number;
  grandTotal?: number;
  salesPerson?: SalesPerson;
  termsAndConditions?: string;
  versionNo?: number;
};

type CustomerDetails = {
  customerName?: string;
  customerCode?: string;
  phone?: string;
  email?: string;
  tradeName?: string;
  customerType?: string;
};

type SellerProfile = {
  companyName: string;
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  gstin: string;
  addressLines: string[];
};

type QuotationPreviewTemplateProps = {
  quotation: Quotation;
  customer?: CustomerDetails | null;
  sellerProfile: SellerProfile;
};

const formatDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMoney = (value?: number, currencyCode?: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode || "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const joinAddress = (address?: Address) =>
  [
    address?.addressLine1,
    address?.addressLine2,
    address?.street,
    [address?.city, address?.state].filter(Boolean).join(", "),
    [address?.country, address?.postalCode].filter(Boolean).join(" - "),
  ]
    .map((line) => String(line || "").trim())
    .filter(Boolean);

const itemAmount = (item: QuotationItem) => {
  const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const discount = Number(item.discountAmount || 0) + Number(item.additionalDiscount || 0);
  const taxable = Math.max(gross - discount, 0);
  const tax = taxable * (Number(item.taxRate || 0) / 100);
  return taxable + tax;
};

const noteLines = (value?: string) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const QuotationPreviewTemplate: React.FC<QuotationPreviewTemplateProps> = ({
  quotation,
  customer,
  sellerProfile,
}) => {
  const billingLines = joinAddress(quotation.billingAddress);
  const shippingLines = joinAddress(quotation.shippingAddress);
  const terms = noteLines(quotation.termsAndConditions);
  const remarks = noteLines(quotation.remarks);
  const customerNotes = noteLines(quotation.customerNotes);
  const items = quotation.items || [];

  return (
    <article className="quotation-preview-sheet">
      <header className="quotation-preview-hero">
        <div>
          <span className="quotation-preview-kicker">Quotation Template</span>
          <h1>{sellerProfile.companyName}</h1>
          <p>{sellerProfile.legalName}</p>
        </div>
        <div className="quotation-preview-badge-block">
          <span className="quotation-preview-badge">Quote #{quotation.quoteNumber || quotation.id}</span>
          <span className="quotation-preview-status">{quotation.status || "DRAFT"}</span>
        </div>
      </header>

      <section className="quotation-preview-top-grid">
        <div className="quotation-preview-panel quotation-preview-brand">
          <h2>Sold By</h2>
          <p className="quotation-preview-brand-name">{sellerProfile.legalName}</p>
          {sellerProfile.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="quotation-preview-meta-stack">
            <span>Email: {sellerProfile.contactEmail || "--"}</span>
            <span>Phone: {sellerProfile.contactPhone || "--"}</span>
            <span>GSTIN: {sellerProfile.gstin || "--"}</span>
          </div>
        </div>

        <div className="quotation-preview-panel quotation-preview-info-grid">
          <div>
            <span className="quotation-preview-label">Quote Date</span>
            <strong>{formatDate(quotation.quoteDate)}</strong>
          </div>
          <div>
            <span className="quotation-preview-label">Valid Until</span>
            <strong>{formatDate(quotation.validUntil)}</strong>
          </div>
          <div>
            <span className="quotation-preview-label">Quotation Type</span>
            <strong>{quotation.quotationType || "--"}</strong>
          </div>
          <div>
            <span className="quotation-preview-label">Version</span>
            <strong>v{quotation.versionNo || 1}</strong>
          </div>
          <div>
            <span className="quotation-preview-label">Sales Person</span>
            <strong>{quotation.salesPerson?.name || "--"}</strong>
          </div>
          <div>
            <span className="quotation-preview-label">Currency</span>
            <strong>{quotation.currencyCode || "INR"}</strong>
          </div>
        </div>
      </section>

      <section className="quotation-preview-address-grid">
        <div className="quotation-preview-panel">
          <span className="quotation-preview-label">Billing Address</span>
          <h3>{customer?.customerName || quotation.billingAddress?.customerName || `Customer #${quotation.customerId}`}</h3>
          {customer?.tradeName && <p>{customer.tradeName}</p>}
          {(billingLines.length ? billingLines : ["Address not available"]).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="quotation-preview-meta-stack">
            <span>Customer Code: {customer?.customerCode || quotation.billingAddress?.customerCode || "--"}</span>
            <span>Email: {customer?.email || quotation.email || "--"}</span>
            <span>Phone: {customer?.phone || "--"}</span>
          </div>
        </div>

        <div className="quotation-preview-panel">
          <span className="quotation-preview-label">Shipping Address</span>
          <h3>{quotation.shippingAddress?.customerName || customer?.customerName || "Delivery Destination"}</h3>
          {(shippingLines.length ? shippingLines : ["Same as billing address"]).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="quotation-preview-meta-stack">
            <span>Subject: {quotation.subject || "--"}</span>
            <span>Customer Type: {customer?.customerType || "--"}</span>
          </div>
        </div>
      </section>

      <section className="quotation-preview-table-wrap">
        <table className="quotation-preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Code</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item, index) => (
                <tr key={`${item.id}-${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.productName || item.description || "Quotation Item"}</strong>
                    <span>
                      {[item.categoryName, item.itemType, item.uom].filter(Boolean).join(" | ") || "Product / Service"}
                    </span>
                    {item.remarks && <em>{item.remarks}</em>}
                  </td>
                  <td>{item.productCode || item.taxCode || "--"}</td>
                  <td>{Number(item.quantity || 0).toLocaleString("en-IN")}</td>
                  <td>{formatMoney(item.unitPrice, quotation.currencyCode)}</td>
                  <td>{formatMoney(Number(item.discountAmount || 0) + Number(item.additionalDiscount || 0), quotation.currencyCode)}</td>
                  <td>{Number(item.taxRate || 0)}%</td>
                  <td>{formatMoney(itemAmount(item), quotation.currencyCode)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="quotation-preview-empty">
                  No line items available for this quotation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="quotation-preview-summary-grid">
        <div className="quotation-preview-panel quotation-preview-notes">
          <span className="quotation-preview-label">Terms & Notes</span>
          <div>
            <h3>Terms and Conditions</h3>
            {terms.length ? (
              <ul>
                {terms.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>No terms added.</p>
            )}
          </div>
          <div>
            <h3>Customer Notes</h3>
            <p>{customerNotes.join(" ") || "No customer notes added."}</p>
          </div>
          <div>
            <h3>Internal Remarks</h3>
            <p>{remarks.join(" ") || quotation.internalNotes || "No additional remarks."}</p>
          </div>
        </div>

        <div className="quotation-preview-panel quotation-preview-summary-card">
          <span className="quotation-preview-label">Quotation Summary</span>
          <div className="quotation-preview-total-row">
            <span>Subtotal</span>
            <strong>{formatMoney(quotation.subTotal, quotation.currencyCode)}</strong>
          </div>
          <div className="quotation-preview-total-row">
            <span>Discount</span>
            <strong>{formatMoney(quotation.discountAmount, quotation.currencyCode)}</strong>
          </div>
          <div className="quotation-preview-total-row">
            <span>Additional Discount</span>
            <strong>{formatMoney(quotation.additionalDiscount, quotation.currencyCode)}</strong>
          </div>
          <div className="quotation-preview-total-row">
            <span>Tax</span>
            <strong>{formatMoney(quotation.taxAmount, quotation.currencyCode)}</strong>
          </div>
          <div className="quotation-preview-total-row quotation-preview-grand-total">
            <span>Grand Total</span>
            <strong>{formatMoney(quotation.grandTotal, quotation.currencyCode)}</strong>
          </div>
          <div className="quotation-preview-summary-foot">
            <span>Prepared by {quotation.salesPerson?.name || sellerProfile.companyName}</span>
            <span>{quotation.salesPerson?.email || sellerProfile.contactEmail || "--"}</span>
          </div>
        </div>
      </section>

      <footer className="quotation-preview-footer">
        <div>
          <span className="quotation-preview-label">Declaration</span>
          <p>
            This quotation is system generated and intended for customer confirmation. Final pricing and fulfillment remain
            subject to stock, tax, and commercial approval.
          </p>
        </div>
        <div className="quotation-preview-signoff">
          <span>Authorized Signatory</span>
          <strong>{sellerProfile.companyName}</strong>
        </div>
      </footer>
    </article>
  );
};

export type { SellerProfile };
export default QuotationPreviewTemplate;
