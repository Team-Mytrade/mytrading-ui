import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createPdf } from "../../utils/pdfDocument";
import { CompanyProfile, companyAddressLines, loadCompanyLogo } from "../../company/companyApi";
import { fitLogo } from "../../components/common/export";
import { brandShade } from "../../company/brand";
import { companyCurrency, formatDate } from "../../company/format";

/** What a proforma needs from a sales order (the Sales Orders page's order). */
export interface ProformaOrder {
  orderNumber: string;
  orderDate?: string;
  proformaNumber?: string | null;
  proformaIssuedAt?: string | null;
  currencyCode?: string;
  paymentTerms?: string;
  dueDate?: string;
  subTotal?: number;
  discountAmount?: number;
  additionalDiscount?: number;
  taxAmount?: number;
  grandTotal?: number;
  customerNotes?: string;
  termsAndConditions?: string;
  billingAddress?: { customerName?: string; addressLine1?: string; addressLine2?: string; street?: string; city?: string; state?: string; country?: string; postalCode?: string } | null;
  shippingAddress?: ProformaOrder["billingAddress"];
  items?: { productName?: string; productCode?: string; description?: string; uom?: string; quantity?: number; unitPrice?: number;
    discountPercentage?: number; taxRate?: number; taxAmount?: number; lineTotal?: number }[];
}

const amount = (value?: number) =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const address = (a?: ProformaOrder["billingAddress"]) =>
  [a?.addressLine1, a?.addressLine2, a?.street, a?.city, a?.state, a?.country, a?.postalCode].filter(Boolean).join(", ") || "-";

/**
 * A proforma invoice for a sales order: the order's lines and totals under the proforma number, for the customer
 * to pay in advance or open a letter of credit. Says plainly that it is not a tax invoice.
 */
export async function createProformaPdf(order: ProformaOrder, company: CompanyProfile | null, customerName: string): Promise<Blob> {
  const logo = await loadCompanyLogo();
  const doc = await createPdf({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const currency = order.currencyCode || companyCurrency();
  const sellerName = company?.legalName || company?.companyName || "My Trading";
  const tableEnd = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0;

  const header = () => {
    doc.setFillColor(...brandShade(600));
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
      doc.text(company?.companyName || "My Trading", margin, 18);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("PROFORMA INVOICE", width - margin, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`No. ${order.proformaNumber || "-"}  |  Sales order ${order.orderNumber}`, width - margin, 20, { align: "right" });
    doc.setTextColor(15, 23, 42);
  };
  const table = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 7.7, cellPadding: 2.4, textColor: [15, 23, 42] as [number, number, number], lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.15 },
    headStyles: { fillColor: brandShade(700), textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    margin: { left: margin, right: margin, top: 37, bottom: 18 },
  };

  header();
  autoTable(doc, { ...table, startY: 39, tableWidth: 87, head: [["SELLER"]], body: [[sellerName], [companyAddressLines(company).join(", ") || "-"],
    [`Email: ${company?.email || "-"}   Phone: ${company?.phone || "-"}`], [`Tax number: ${company?.gstin || "-"}`]] });
  const sellerEnd = tableEnd();
  autoTable(doc, { ...table, startY: 39, margin: { ...table.margin, left: 109 }, tableWidth: 87, head: [["BILL TO"]],
    body: [[customerName], [address(order.billingAddress)]] });
  let y = Math.max(sellerEnd, tableEnd(), 70) + 5;
  autoTable(doc, { ...table, startY: y, head: [["DETAILS", "", "", ""]], body: [
    ["Proforma date", formatDate(order.proformaIssuedAt || undefined) || "-", "Currency", currency],
    ["Sales order", order.orderNumber, "Order date", formatDate(order.orderDate) || "-"],
    ["Payment terms", order.paymentTerms || "-", "Due", formatDate(order.dueDate) || "-"],
    ["Ship to", { content: address(order.shippingAddress), colSpan: 3 }],
  ], columnStyles: { 0: { cellWidth: 30, fontStyle: "bold", textColor: [71, 85, 105] }, 1: { cellWidth: 61 }, 2: { cellWidth: 30, fontStyle: "bold", textColor: [71, 85, 105] }, 3: { cellWidth: 61 } } });
  y = tableEnd() + 5;
  autoTable(doc, { ...table, startY: y, head: [["#", "ITEM / DESCRIPTION", "QTY", "RATE", "DISC.", "TAX", "AMOUNT"]],
    body: (order.items || []).map((item, index) => [
      String(index + 1),
      [item.productName || item.description || "Item", [item.productCode, item.uom].filter(Boolean).join(" | "),
        item.description && item.description !== item.productName ? item.description : ""].filter(Boolean).join("\n"),
      String(item.quantity ?? 0), `${currency} ${amount(item.unitPrice)}`, `${Number(item.discountPercentage || 0)}%`,
      `${Number(item.taxRate || 0)}%`, `${currency} ${amount(item.lineTotal)}`,
    ]),
    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 68 }, 2: { cellWidth: 14, halign: "right" }, 3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 14, halign: "right" }, 5: { cellWidth: 14, halign: "right" }, 6: { cellWidth: 38, halign: "right" } },
    didDrawPage: header });
  y = tableEnd() + 5;
  if (y > height - 60) { doc.addPage(); header(); y = 40; }
  autoTable(doc, { ...table, startY: y, margin: { ...table.margin, left: 118 }, tableWidth: 78, head: [["TOTALS", "AMOUNT"]], body: [
    ["Subtotal", `${currency} ${amount(order.subTotal)}`],
    ["Discount", `- ${currency} ${amount(Number(order.discountAmount || 0) + Number(order.additionalDiscount || 0))}`],
    ["Tax", `${currency} ${amount(order.taxAmount)}`],
    ["AMOUNT DUE", `${currency} ${amount(order.grandTotal)}`],
  ], columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 38, halign: "right", fontStyle: "bold" } } });
  y = tableEnd() + 6;
  const notes = [["Notes", order.customerNotes ?? ""], ["Terms and conditions", order.termsAndConditions ?? ""]].filter(([, value]) => Boolean(value));
  if (notes.length) {
    if (y > height - 50) { doc.addPage(); header(); y = 40; }
    autoTable(doc, { ...table, startY: y, head: [["NOTES AND TERMS", ""]], body: notes,
      columnStyles: { 0: { cellWidth: 36, fontStyle: "bold", textColor: [71, 85, 105] }, 1: { cellWidth: 146 } } });
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, height - 13, width - margin, height - 13);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("This is a proforma invoice, not a tax invoice. A tax invoice follows when the goods are supplied.", margin, height - 8);
    doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, width - margin, height - 8, { align: "right" });
  }
  return doc.output("blob");
}
