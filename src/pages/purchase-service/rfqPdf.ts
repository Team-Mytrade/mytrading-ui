// Request for quotation document: what a vendor receives (print or email attachment). No prices; same look as the PO.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { companyAddressLines, loadCompany, loadCompanyLogo } from "../../company/companyApi";
import { formatDate, formatDateHijri, formatNumber, pdfText } from "../../company/format";
import { fitLogo } from "../../components/common/export";
import { brandShade } from "../../company/brand";
import type { Rfq, RfqVendor } from "../../purchase/rfqApi";
import type { VendorRecord } from "./purchaseOrderPdf";

const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];

export async function rfqPdf(rfq: Rfq, row: RfqVendor, vendor: VendorRecord | null): Promise<Blob> {
  const [company, logo] = await Promise.all([loadCompany(), loadCompanyLogo()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const t = (value: unknown) => pdfText(String(value ?? "").trim() || "-");
  const tableEnd = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0;
  const buyerName = company?.legalName || company?.companyName || "My Trading";

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
      doc.text(t(buyerName), margin, 18);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("REQUEST FOR QUOTATION", width - margin, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(t(`No. ${rfq.rfqNumber}  |  ${formatDate(rfq.rfqDate)}`), width - margin, 20, { align: "right" });
    doc.setTextColor(...INK);
  };
  const table = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.15, valign: "middle" as const },
    headStyles: { fillColor: brandShade(700), textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    margin: { left: margin, right: margin, top: 37, bottom: 18 },
  };
  const label = { fontStyle: "bold" as const, textColor: [71, 85, 105] as [number, number, number] };

  header();
  autoTable(doc, { ...table, startY: 39, tableWidth: 87, head: [["FROM"]], body: [
    [t(buyerName)],
    [t(companyAddressLines(company).join(", "))],
    [t([company?.phone ? `Phone: ${company.phone}` : "", company?.email ? `Email: ${company.email}` : ""].filter(Boolean).join("   "))],
  ] });
  const buyerEnd = tableEnd();
  const vendorAddress = [vendor?.address, vendor?.city, vendor?.state, vendor?.postalCode, vendor?.country].filter(Boolean).join(", ");
  autoTable(doc, { ...table, startY: 39, margin: { ...table.margin, left: 109 }, tableWidth: 87, head: [["TO"]], body: [
    [t((vendor?.legalName || vendor?.name || row.vendorName || "") + (row.vendorCode ? ` (${row.vendorCode})` : ""))],
    [t(vendorAddress)],
    [t([vendor?.contactName, vendor?.contactPhone, vendor?.contactEmail].filter(Boolean).join("   "))],
  ] });
  let y = Math.max(buyerEnd, tableEnd()) + 5;

  autoTable(doc, { ...table, startY: y, head: [[{ content: "DETAILS", colSpan: 4 }]], body: [
    ["RFQ number", t(rfq.rfqNumber), "Date", t(formatDateHijri(rfq.rfqDate, "-", true))],
    ["Subject", t(rfq.title), "Reply by", t(formatDate(rfq.responseDueDate))],
  ], columnStyles: { 0: { cellWidth: 30, ...label }, 1: { cellWidth: 61 }, 2: { cellWidth: 30, ...label }, 3: { cellWidth: 61 } } });
  y = tableEnd() + 5;

  autoTable(doc, {
    ...table,
    startY: y,
    head: [["#", "ITEM", "QTY", "UNIT", "UNIT PRICE", "LEAD TIME (DAYS)"]],
    body: rfq.lines.map((line, i) => [
      String(i + 1),
      t([line.productName, line.productCode ? `(${line.productCode})` : "", line.remarks ? `\n${line.remarks}` : ""].filter(Boolean).join(" ")),
      formatNumber(line.quantity, 3),
      t(line.uom),
      "",
      "",
    ]),
    columnStyles: {
      0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 82 }, 2: { cellWidth: 16, halign: "right" }, 3: { cellWidth: 16 },
      4: { cellWidth: 30 }, 5: { cellWidth: 30 },
    },
    didDrawPage: header,
  });
  y = tableEnd() + 5;

  const notes = [
    `Please quote your unit prices${row.currency ? ` in ${row.currency}` : ""}, delivery time and how long the quote is valid.`,
    rfq.notes?.trim() || "",
  ].filter(Boolean).join("\n");
  autoTable(doc, { ...table, startY: y, head: [["NOTES"]], body: [[t(notes)]], didDrawPage: header });

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.line(margin, height - 13, width - margin, height - 13);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text(t(`${buyerName} · Request for quotation ${rfq.rfqNumber}`), margin, height - 8);
    doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, width - margin, height - 8, { align: "right" });
  }
  return doc.output("blob");
}

/** Opens the RFQ in a new tab to print (downloads it when pop-ups are blocked). */
export async function printRfq(rfq: Rfq, row: RfqVendor, vendor: VendorRecord | null): Promise<void> {
  const url = URL.createObjectURL(await rfqPdf(rfq, row, vendor));
  if (!window.open(url, "_blank")) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${rfq.rfqNumber.replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
