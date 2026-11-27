// Delivery challan (delivery note print): what the driver hands over and the customer signs for.
// Same look as the quotation PDF: company band, seller and consignee boxes, lines, then signature boxes.
import { jsPDF } from "jspdf";
import { createPdf } from "../../utils/pdfDocument";
import autoTable from "jspdf-autotable";
import { companyAddressLines, loadCompany, loadCompanyLogo } from "../../company/companyApi";
import { formatDateHijri, formatDateTime, formatNumber, pdfText } from "../../company/format";
import { fitLogo } from "../../components/common/export";

import { brandShade } from "../../company/brand";
import axios from "axios";
import { DeliveryProof, PROOF_API, imageDataUrl, officeFileUrl } from "./proofOfDelivery";

const imageFormat = (dataUrl: string) => (dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG");
export interface ChallanLine {
  productName: string;
  orderedQty: number;
  deliveredQty?: number | null;
}

/** Proof of delivery from Driver Mode, with its pictures as data URLs (DEL-1). */
export interface ChallanProof {
  receiverName: string;
  receiverMobile?: string | null;
  capturedAt: string;
  capturedBy?: string | null;
  vehiclePlate?: string | null;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  positionSource?: string | null;
  codeVerified: boolean;
  codeSentTo?: string | null;
  signature?: string | null;
  photos: string[];
}

/** The latest proof of delivery for the challan (null when there is none or it can't be read). */
export async function challanProof(query: Record<string, number>): Promise<ChallanProof | null> {
  try {
    const { data } = await axios.get<DeliveryProof[]>(PROOF_API, { params: query });
    const p = Array.isArray(data) ? data[0] : null;
    if (!p) return null;
    const [signature, ...photos] = await Promise.all([
      p.signature ? imageDataUrl(officeFileUrl(p, p.signature)) : Promise.resolve(null),
      ...p.photos.filter((f) => f.contentType !== "image/webp").slice(0, 3).map((f) => imageDataUrl(officeFileUrl(p, f))),
    ]);
    return { ...p, signature, photos: photos.filter((x): x is string => !!x) };
  } catch {
    return null;
  }
}

export interface ChallanData {
  proof?: ChallanProof | null;
  deliveryNo: string;
  deliveryDate?: string;
  status?: string;
  confirmedAt?: string | null;
  customerName: string;
  customerCode?: string | null;
  deliveryAddress?: string | null;
  deliveryOrderNumber?: string | null;
  salesOrderLabel?: string | null;
  salesDispatchNumber?: string | null;
  vehiclePlate?: string | null;
  transporterName?: string | null;
  lines: ChallanLine[];
}

// The company's colour (brand.ts), read when the PDF is drawn
const BRAND = (): [number, number, number] => brandShade(600);
const HEAD = (): [number, number, number] => brandShade(700);
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];

/** Builds the challan and opens it in a new tab to print (downloads it when pop-ups are blocked). */
export async function printDeliveryChallan(data: ChallanData): Promise<void> {
  const [company, logo] = await Promise.all([loadCompany(), loadCompanyLogo()]);
  const doc = await createPdf({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const t = (value: unknown) => pdfText(String(value ?? "").trim() || "-");
  const tableEnd = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0;
  const sellerName = company?.legalName || company?.companyName || "My Trading";
  // VAT companies show their TRN, GST companies their GSTIN
  const taxLine = company?.taxRegime === "VAT" && company.taxNumber ? `TRN: ${company.taxNumber}`
    : company?.taxRegime === "TIN" && company.taxNumber ? `TIN: ${company.taxNumber}`
    : company?.taxRegime !== "NONE" && company?.gstin ? `GSTIN: ${company.gstin}` : "";

  const header = () => {
    doc.setFillColor(...BRAND());
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
      doc.text(t(sellerName), margin, 18);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("DELIVERY CHALLAN", width - margin, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(t(`No. ${data.deliveryNo}  |  ${formatDateHijri(data.deliveryDate, "-", true)}`), width - margin, 20, { align: "right" });
    doc.setTextColor(...INK);
  };
  const table = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.15, valign: "middle" as const },
    headStyles: { fillColor: HEAD(), textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    margin: { left: margin, right: margin, top: 37, bottom: 18 },
  };

  header();
  autoTable(doc, { ...table, startY: 39, tableWidth: 87, head: [["FROM"]], body: [
    [t(sellerName)],
    [t(companyAddressLines(company).join(", "))],
    [t([company?.phone ? `Phone: ${company.phone}` : "", taxLine].filter(Boolean).join("   "))],
  ] });
  const fromEnd = tableEnd();
  autoTable(doc, { ...table, startY: 39, margin: { ...table.margin, left: 109 }, tableWidth: 87, head: [["DELIVER TO"]], body: [
    [t(data.customerName + (data.customerCode ? ` (${data.customerCode})` : ""))],
    [t(data.deliveryAddress || "Address as on the sales order")],
  ] });
  let y = Math.max(fromEnd, tableEnd()) + 5;

  autoTable(doc, { ...table, startY: y, head: [[{ content: "DELIVERY DETAILS", colSpan: 4 }]], body: [
    ["Delivery order", t(data.deliveryOrderNumber), "Vehicle", t(data.vehiclePlate)],
    ["Sales order", t(data.salesOrderLabel), "Transporter", t(data.transporterName)],
    ["Dispatch", t(data.salesDispatchNumber), "Status", t(data.confirmedAt ? `Delivered ${formatDateTime(data.confirmedAt)}` : data.status)],
  ], columnStyles: { 0: { cellWidth: 30, fontStyle: "bold", textColor: [71, 85, 105] }, 1: { cellWidth: 61 }, 2: { cellWidth: 30, fontStyle: "bold", textColor: [71, 85, 105] }, 3: { cellWidth: 61 } } });
  y = tableEnd() + 5;

  const totalOrdered = data.lines.reduce((sum, l) => sum + Number(l.orderedQty || 0), 0);
  const totalDelivered = data.lines.reduce((sum, l) => sum + Number(l.deliveredQty ?? l.orderedQty ?? 0), 0);
  autoTable(doc, {
    ...table,
    startY: y,
    head: [["#", "ITEM", "QTY ORDERED", "QTY DELIVERED", "RECEIVED OK"]],
    body: data.lines.map((line, i) => [
      String(i + 1), t(line.productName), formatNumber(line.orderedQty, 3),
      formatNumber(line.deliveredQty ?? line.orderedQty, 3), "",
    ]),
    foot: [["", `${data.lines.length} item(s)`, formatNumber(totalOrdered, 3), formatNumber(totalDelivered, 3), ""]],
    footStyles: { fillColor: [241, 245, 249], textColor: INK, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 92 }, 2: { cellWidth: 26, halign: "right" }, 3: { cellWidth: 28, halign: "right" }, 4: { cellWidth: 26 } },
    didDrawPage: header,
  });
  y = tableEnd() + 8;

  // Signatures: who sent it, who drove it, who received it (the customer's copy is the proof of delivery)
  if (y > height - 62) {
    doc.addPage();
    header();
    y = 40;
  }
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Received the above goods in good order and condition.", margin, y);
  y += 4;
  const boxWidth = (width - margin * 2 - 8) / 3;
  ["Dispatched by", "Driver", "Received by (customer)"].forEach((label, i) => {
    const x = margin + i * (boxWidth + 4);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, boxWidth, 34, 1.5, 1.5);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(label, x + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    const proof = i === 2 ? data.proof : null;
    doc.text(proof ? t(`Name: ${proof.receiverName}`) : "Name:", x + 3, y + 14);
    doc.text("Signature:", x + 3, y + 22);
    if (proof?.signature) {
      try {
        doc.addImage(proof.signature, imageFormat(proof.signature), x + 19, y + 16, boxWidth - 22, 10);
      } catch {
        /* unreadable picture: the box stays empty */
      }
    }
    doc.text(proof ? t(`Date: ${formatDateTime(proof.capturedAt)}`) : i === 2 ? "Date & stamp:" : "Date:", x + 3, y + 30);
  });
  y += 38;

  // Proof of delivery captured at the door (Driver Mode)
  const proof = data.proof;
  if (proof) {
    if (y > height - 60) {
      doc.addPage();
      header();
      y = 40;
    }
    const place = proof.latitude != null && proof.longitude != null
      ? `${proof.latitude.toFixed(6)}, ${proof.longitude.toFixed(6)} (${proof.positionSource === "TRIP" ? "trip's last position" : "phone GPS"})`
      : "-";
    autoTable(doc, { ...table, startY: y, head: [[{ content: "PROOF OF DELIVERY", colSpan: 4 }]], body: [
      // Name and mobile in cells of their own: an Arabic name and digits in one cell get reordered
      ["Received by", t(proof.receiverName), "Mobile", t(proof.receiverMobile)],
      ["Time", t(formatDateTime(proof.capturedAt)), "Status", t(proof.status === "PARTIAL" ? "Partly delivered" : "Delivered")],
      ["Location", t(place), "Driver", t([proof.capturedBy, proof.vehiclePlate].filter(Boolean).join(" · "))],
      ["One-time code", t(proof.codeVerified ? `Confirmed${proof.codeSentTo ? ` (sent to ${proof.codeSentTo})` : ""}` : "Not used"), "", ""],
    ], columnStyles: { 0: { cellWidth: 30, fontStyle: "bold", textColor: [71, 85, 105] }, 1: { cellWidth: 61 }, 2: { cellWidth: 30, fontStyle: "bold", textColor: [71, 85, 105] }, 3: { cellWidth: 61 } } });
    y = tableEnd() + 4;
    if (proof.photos.length) {
      if (y > height - 60) {
        doc.addPage();
        header();
        y = 40;
      }
      proof.photos.forEach((photo, i) => {
        try {
          const props = doc.getImageProperties(photo);
          const scale = Math.min(58 / props.width, 40 / props.height);
          doc.addImage(photo, imageFormat(photo), margin + i * 62, y, props.width * scale, props.height * scale);
        } catch {
          /* skipped */
        }
      });
    }
  }

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.line(margin, height - 13, width - margin, height - 13);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text(t(`${sellerName} · Delivery challan ${data.deliveryNo}`), margin, height - 8);
    doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, width - margin, height - 8, { align: "right" });
  }

  const url = URL.createObjectURL(doc.output("blob"));
  const opened = window.open(url, "_blank");
  if (!opened) doc.save(`${data.deliveryNo}.pdf`);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
