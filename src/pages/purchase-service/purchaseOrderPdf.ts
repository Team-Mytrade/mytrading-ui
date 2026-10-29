// Purchase order document: what the vendor receives (print or email attachment).
// Same look as the quotation and delivery challan: company band, buyer and vendor boxes, lines, totals, terms.
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { companyAddressLines, loadCompany, loadCompanyLogo } from "../../company/companyApi";
import { formatAmount, formatDate, formatMoney, formatNumber, pdfText } from "../../company/format";
import { fitLogo } from "../../components/common/export";

const PURCHASE = "/v1/api/purchase";

export interface PurchaseOrderLine {
  productName?: string;
  productCode?: string;
  quantity?: number;
  unitOfMeasure?: string;
  unitPrice?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalPrice?: number;
  remarks?: string;
}

export interface PurchaseOrderRecord {
  id: number;
  poNumber?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  status?: string;
  approvalStatus?: string;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: string;
  paymentTerms?: string;
  shippingAddress?: string;
  notes?: string;
  sentToVendorAt?: string | null;
  vendor?: { id?: number; vendorCode?: string; name?: string };
  requisitionNumber?: string;
  termsAndConditionsId?: number | null;
  termsAndConditionsTitle?: string | null;
  items?: PurchaseOrderLine[];
}

export interface VendorRecord {
  id?: number;
  vendorCode?: string;
  name?: string;
  legalName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface PurchaseOrderDoc {
  po: PurchaseOrderRecord;
  vendor: VendorRecord | null;
  terms: { title?: string; content?: string } | null;
}

const BRAND: [number, number, number] = [8, 145, 178];
const HEAD: [number, number, number] = [14, 116, 144];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];

/** The order with its vendor's contact details and its terms text (both optional: the PO still prints). */
export async function loadPurchaseOrderDoc(id: number | string): Promise<PurchaseOrderDoc> {
  const { data: po } = await axios.get<PurchaseOrderRecord>(`${PURCHASE}/purchase-orders/${id}`);
  const [vendor, terms] = await Promise.all([
    po.vendor?.id
      ? axios.get<VendorRecord>(`/v1/api/common/vendors/${po.vendor.id}`).then((r) => r.data, () => null)
      : Promise.resolve(null),
    po.termsAndConditionsId
      ? axios.get<{ title?: string; content?: string }>(`${PURCHASE}/terms/${po.termsAndConditionsId}`).then((r) => r.data, () => null)
      : Promise.resolve(null),
  ]);
  return { po, vendor, terms };
}

export const isPoApproved = (po: Pick<PurchaseOrderRecord, "approvalStatus" | "status">) =>
  String(po.approvalStatus || "").toUpperCase() === "APPROVED" && String(po.status || "").toUpperCase() !== "DRAFT";

/** Builds the PO as a PDF. Orders not yet approved carry a "not approved" mark so they aren't mistaken for the real one. */
export async function purchaseOrderPdf({ po, vendor, terms }: PurchaseOrderDoc): Promise<Blob> {
  const [company, logo] = await Promise.all([loadCompany(), loadCompanyLogo()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const t = (value: unknown) => pdfText(String(value ?? "").trim() || "-");
  const tableEnd = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0;
  const currency = po.currency || company?.currency || "";
  const number = po.poNumber || `PO #${po.id}`;
  const buyerName = company?.legalName || company?.companyName || "My Trading";
  const regime = company?.taxRegime ?? "GST";
  const buyerTax = regime === "VAT" && company?.taxNumber ? `TRN: ${company.taxNumber}`
    : regime !== "NONE" && company?.gstin ? `GSTIN: ${company.gstin}` : "";
  const taxLabel = regime === "VAT" ? "VAT" : regime === "GST" ? "GST" : "Tax";
  const approved = isPoApproved(po);

  const header = () => {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, width, 31, "F");
    if (logo) {
      const size = fitLogo(logo, 38, 9);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 7, 42, 12, 2, 2, "F");
      doc.addImage(logo.dataUrl, logo.format, margin + 2 + (38 - size.width) / 2, 8.5 + (9 - size.height) / 2, size.width, size.height);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(t(buyerName), margin, 18);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("PURCHASE ORDER", width - margin, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(t(`No. ${number}  |  ${formatDate(po.orderDate)}`), width - margin, 20, { align: "right" });
    if (!approved) {
      doc.setFont("helvetica", "bold");
      doc.text("NOT APPROVED - FOR REVIEW ONLY", width - margin, 26, { align: "right" });
    }
    doc.setTextColor(...INK);
  };
  const table = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.15, valign: "middle" as const },
    headStyles: { fillColor: HEAD, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    margin: { left: margin, right: margin, top: 37, bottom: 18 },
  };
  const label = { fontStyle: "bold" as const, textColor: [71, 85, 105] as [number, number, number] };

  header();
  autoTable(doc, { ...table, startY: 39, tableWidth: 87, head: [["BUYER"]], body: [
    [t(buyerName)],
    [t(companyAddressLines(company).join(", "))],
    [t([company?.phone ? `Phone: ${company.phone}` : "", company?.email ? `Email: ${company.email}` : ""].filter(Boolean).join("   "))],
    ...(buyerTax ? [[t(buyerTax)]] : []),
  ] });
  const buyerEnd = tableEnd();
  const vendorAddress = [vendor?.address, vendor?.city, vendor?.state, vendor?.postalCode, vendor?.country].filter(Boolean).join(", ");
  autoTable(doc, { ...table, startY: 39, margin: { ...table.margin, left: 109 }, tableWidth: 87, head: [["VENDOR"]], body: [
    [t((vendor?.legalName || vendor?.name || po.vendor?.name || "") + (po.vendor?.vendorCode ? ` (${po.vendor.vendorCode})` : ""))],
    [t(vendorAddress)],
    [t([vendor?.contactName, vendor?.contactPhone, vendor?.contactEmail].filter(Boolean).join("   "))],
    ...(vendor?.gstNumber ? [[t(`${regime === "VAT" ? "TRN" : "GSTIN"}: ${vendor.gstNumber}`)]] : []),
  ] });
  let y = Math.max(buyerEnd, tableEnd()) + 5;

  autoTable(doc, { ...table, startY: y, head: [[{ content: "ORDER DETAILS", colSpan: 4 }]], body: [
    ["PO number", t(number), "Order date", t(formatDate(po.orderDate))],
    ["Requisition", t(po.requisitionNumber), "Deliver by", t(formatDate(po.expectedDeliveryDate))],
    ["Payment terms", t(po.paymentTerms), "Currency", t(currency)],
  ], columnStyles: { 0: { cellWidth: 30, ...label }, 1: { cellWidth: 61 }, 2: { cellWidth: 30, ...label }, 3: { cellWidth: 61 } } });
  y = tableEnd() + 5;

  autoTable(doc, { ...table, startY: y, head: [["DELIVER TO"]], body: [
    [t(po.shippingAddress || [buyerName, ...companyAddressLines(company)].join(", "))],
  ] });
  y = tableEnd() + 5;

  const items = po.items || [];
  autoTable(doc, {
    ...table,
    startY: y,
    head: [["#", "ITEM", "QTY", "UNIT", "UNIT PRICE", "DISCOUNT", taxLabel.toUpperCase(), "AMOUNT"]],
    body: items.map((item, i) => [
      String(i + 1),
      t([item.productName, item.productCode ? `(${item.productCode})` : "", item.remarks ? `\n${item.remarks}` : ""].filter(Boolean).join(" ")),
      formatNumber(item.quantity, 3),
      t(item.unitOfMeasure),
      formatAmount(item.unitPrice, currency),
      formatAmount(item.discountAmount, currency),
      formatAmount(item.taxAmount, currency),
      formatAmount(item.totalPrice, currency),
    ]),
    columnStyles: {
      0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 56 }, 2: { cellWidth: 14, halign: "right" }, 3: { cellWidth: 16 },
      4: { cellWidth: 22, halign: "right" }, 5: { cellWidth: 20, halign: "right" }, 6: { cellWidth: 20, halign: "right" }, 7: { cellWidth: 26, halign: "right" },
    },
    didDrawPage: header,
  });
  y = tableEnd() + 3;

  autoTable(doc, {
    ...table,
    startY: y,
    margin: { ...table.margin, left: 116 },
    tableWidth: 80,
    body: [
      ["Subtotal", formatAmount(po.subtotal, currency)],
      ["Discount", `- ${formatAmount(po.discountAmount, currency)}`],
      [taxLabel, formatAmount(po.taxAmount, currency)],
      [{ content: "Total", styles: { fontStyle: "bold" } }, { content: t(formatMoney(po.totalAmount, { currency })), styles: { fontStyle: "bold" } }],
    ],
    columnStyles: { 0: { cellWidth: 34, ...label }, 1: { cellWidth: 46, halign: "right" } },
  });
  y = tableEnd() + 5;

  const notes: string[][] = [];
  if (po.notes?.trim()) notes.push(["Notes", t(po.notes)]);
  if (terms?.content?.trim()) notes.push([t(terms.title || po.termsAndConditionsTitle || "Terms"), t(terms.content)]);
  if (notes.length) {
    autoTable(doc, { ...table, startY: y, head: [[{ content: "NOTES AND TERMS", colSpan: 2 }]], body: notes,
      columnStyles: { 0: { cellWidth: 36, ...label }, 1: { cellWidth: 146 } }, didDrawPage: header });
    y = tableEnd() + 8;
  } else {
    y += 3;
  }

  // Signature: the buyer's authorised signatory, and the vendor's acceptance
  if (y > height - 50) {
    doc.addPage();
    header();
    y = 40;
  }
  const boxWidth = (width - margin * 2 - 6) / 2;
  [`For ${buyerName}`, "Accepted by the vendor"].forEach((title, i) => {
    const x = margin + i * (boxWidth + 6);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, boxWidth, 30, 1.5, 1.5);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(t(title), x + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(i === 0 ? "Authorised signatory" : "Name & signature", x + 3, y + 22);
    doc.text(i === 0 ? "Date:" : "Date & stamp:", x + 3, y + 27);
  });

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.line(margin, height - 13, width - margin, height - 13);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text(t(`${buyerName} · Purchase order ${number}`), margin, height - 8);
    doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, width - margin, height - 8, { align: "right" });
  }
  return doc.output("blob");
}

/** Opens the PO in a new tab to print (downloads it when pop-ups are blocked). */
export async function printPurchaseOrder(data: PurchaseOrderDoc): Promise<void> {
  const blob = await purchaseOrderPdf(data);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.po.poNumber || `purchase-order-${data.po.id}`).replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
