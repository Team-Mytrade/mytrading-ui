// Final settlement of a leaving Gulf employee: the end-of-service gratuity worked out by the payroll service and the
// final month's pay that carries it. Shown in a dialog on Exit Approvals and printed as a statement.
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { companyAddressLines, loadCompany, loadCompanyLogo } from "../../company/companyApi";
import { formatAmount, formatDate, formatDateHijri, formatMoney, formatNumber, pdfText } from "../../company/format";
import { fitLogo } from "../../components/common/export";

import { brandShade } from "../../company/brand";
const GRATUITY_API = "/v1/api/payroll/gratuity";

export type SeparationType = "RESIGNATION" | "TERMINATION" | "CONTRACT_END" | "DISMISSAL";

// How the employment ended (decides the Saudi award; the UAE gratuity is the same for all)
export const SEPARATION_LABELS: Record<SeparationType, string> = {
  RESIGNATION: "Resignation",
  TERMINATION: "Ended by the employer",
  CONTRACT_END: "End of a fixed-term contract",
  DISMISSAL: "Dismissed for misconduct",
};

export interface SettlementLine {
  label: string;
  amount: number;
}

export interface GratuityCalculation {
  country: string;
  due: boolean;
  wageBasis: string | null;
  monthlyWage: number;
  from: string | null;
  to: string | null;
  serviceDays: number;
  unpaidDays: number;
  years: number;
  lines: SettlementLine[];
  amount: number;
  approximate: boolean;
  note: string | null;
}

// Annual leave not taken, paid at the exit: days × (monthly wage / 30)
export interface LeavePay {
  days: number;
  wageBasis: string;
  dailyWage: number;
  amount: number;
  approximate: boolean;
}

export interface SettlementStatement {
  exitRequestId: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  countryCode: string;
  nationality: string | null;
  currency: string;
  joiningDate: string;
  lastWorkingDay: string;
  separationType: SeparationType;
  gratuity: GratuityCalculation;
  unusedLeave: LeavePay;
  finalMonth: string;
  finalPayProcessed: boolean;
  earnings: SettlementLine[];
  deductions: SettlementLine[];
  totalEarnings: number | null;
  totalDeductions: number | null;
  netPay: number | null;
  // The gratuity and unused leave lines on the processed final pay (null before the run)
  gratuityPaid: number | null;
  unusedLeavePaid: number | null;
  settlementRecorded: boolean;
}

export interface GratuityProvisionRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  countryCode: string;
  currency: string;
  joiningDate: string;
  years: number;
  wageBasis: string;
  monthlyWage: number;
  amount: number;
  approximate: boolean;
  note: string | null;
}

export interface GratuityProvision {
  asOf: string;
  rows: GratuityProvisionRow[];
  totals: Record<string, number>;
}

export const loadSettlement = (exitRequestId: number) =>
  axios.get<SettlementStatement>(`${GRATUITY_API}/settlement/${exitRequestId}`).then((r) => r.data);

export const loadGratuityProvision = (asOf?: string) =>
  axios.get<GratuityProvision>(`${GRATUITY_API}/provision`, { params: asOf ? { asOf } : undefined }).then((r) => r.data);

/** "7 years 2 months" style, from the years counted (365-day years); pass t() to word it in the screen language. */
export const serviceLength = (years: number, tr: (text: string) => string = (text) => text): string => {
  const whole = Math.floor(years);
  const months = Math.floor((years - whole) * 12 + 1e-9);
  return [whole ? `${whole} ${tr(whole === 1 ? "year" : "years")}` : "", months ? `${months} ${tr(months === 1 ? "month" : "months")}` : ""]
    .filter(Boolean).join(" ") || tr("Under a month");
};

/** The paid gratuity differs from what it works out at now (salary, dates or type changed after the run). */
export const gratuityMismatch = (s: SettlementStatement) =>
  s.finalPayProcessed && s.gratuity.due && Math.abs((s.gratuityPaid ?? 0) - s.gratuity.amount) >= 0.01;

/** The same for the unused leave (its days changed after the run). */
export const leaveMismatch = (s: SettlementStatement) =>
  s.finalPayProcessed && Math.abs((s.unusedLeavePaid ?? 0) - (s.unusedLeave?.amount ?? 0)) >= 0.01;

// The company's colour (brand.ts), read when the PDF is drawn
const BRAND = (): [number, number, number] => brandShade(600);
const HEAD = (): [number, number, number] => brandShade(700);
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];

/** The statement as a PDF (English, like the other printed documents). */
export async function settlementPdf(s: SettlementStatement): Promise<Blob> {
  const [company, logo] = await Promise.all([loadCompany(), loadCompanyLogo()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const t = (value: unknown) => pdfText(String(value ?? "").trim() || "-");
  const tableEnd = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0;
  const companyName = company?.legalName || company?.companyName || "My Trading";
  const money = (value: unknown) => formatAmount(value, s.currency);

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
    doc.text(t(companyName), margin, 18);
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FINAL SETTLEMENT", width - margin, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(t(`${s.employeeName} (${s.employeeCode})  |  Last day ${formatDate(s.lastWorkingDay)}`), width - margin, 20, { align: "right" });
  doc.setTextColor(...INK);

  const table = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.15, valign: "middle" as const },
    headStyles: { fillColor: HEAD(), textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    margin: { left: margin, right: margin, top: 20, bottom: 18 },
  };
  const label = { fontStyle: "bold" as const, textColor: [71, 85, 105] as [number, number, number] };

  autoTable(doc, { ...table, startY: 39, head: [[{ content: "EMPLOYEE", colSpan: 4 }]], body: [
    ["Name", t(s.employeeName), "Employee code", t(s.employeeCode)],
    ["Designation", t(s.designation), "Department", t(s.department)],
    ["Joined", t(formatDateHijri(s.joiningDate, "-", true)), "Last working day", t(formatDateHijri(s.lastWorkingDay, "-", true))],
    ["Service", t(`${serviceLength(s.gratuity.years)} (${formatNumber(s.gratuity.years, 2)} years)`
      + (s.gratuity.unpaidDays ? `, ${s.gratuity.unpaidDays} unpaid days not counted` : "")),
      "How it ended", t(SEPARATION_LABELS[s.separationType] ?? s.separationType)],
    ["Payroll country", t(s.countryCode), "Currency", t(s.currency)],
  ], columnStyles: { 0: { cellWidth: 32, ...label }, 1: { cellWidth: 59 }, 2: { cellWidth: 32, ...label }, 3: { cellWidth: 59 } } });
  let y = tableEnd() + 5;

  const gratuityBody: (string | { content: string; styles?: object })[][] = s.gratuity.due
    ? [
        ["Monthly wage", t(`${money(s.gratuity.monthlyWage)}  (${s.gratuity.wageBasis ?? ""})`)],
        ...s.gratuity.lines.map((line) => [t(line.label), money(line.amount)]),
        [{ content: "End-of-service gratuity", styles: { fontStyle: "bold" } }, { content: t(formatMoney(s.gratuity.amount, { currency: s.currency })), styles: { fontStyle: "bold" } }],
      ]
    : [["Not due", t(s.gratuity.note)]];
  if (s.gratuity.due && s.gratuity.note) gratuityBody.push(["Note", t(s.gratuity.note)]);
  autoTable(doc, { ...table, startY: y, head: [[{ content: "END-OF-SERVICE GRATUITY", colSpan: 2 }]], body: gratuityBody,
    columnStyles: { 0: { cellWidth: 132 }, 1: { cellWidth: 50, halign: "right" } } });
  y = tableEnd() + 5;

  if (s.unusedLeave?.days > 0) {
    autoTable(doc, { ...table, startY: y, head: [[{ content: "UNUSED ANNUAL LEAVE", colSpan: 2 }]], body: [
      [t(`${formatNumber(s.unusedLeave.days, 1)} days x ${money(s.unusedLeave.dailyWage)} a day (${s.unusedLeave.wageBasis} / 30)`), money(s.unusedLeave.amount)],
    ], columnStyles: { 0: { cellWidth: 132 }, 1: { cellWidth: 50, halign: "right" } } });
    y = tableEnd() + 5;
  }

  if (s.finalPayProcessed) {
    const rows = [
      ...s.earnings.map((line) => [t(line.label), money(line.amount), ""]),
      ...s.deductions.map((line) => [t(line.label), "", money(line.amount)]),
      [{ content: "Totals", styles: { fontStyle: "bold" as const } }, money(s.totalEarnings), money(s.totalDeductions)],
    ];
    autoTable(doc, { ...table, startY: y, head: [[`FINAL PAY (${s.finalMonth})`, "EARNINGS", "DEDUCTIONS"]], body: rows,
      columnStyles: { 0: { cellWidth: 102 }, 1: { cellWidth: 40, halign: "right" }, 2: { cellWidth: 40, halign: "right" } } });
    y = tableEnd() + 3;
    autoTable(doc, { ...table, startY: y, margin: { ...table.margin, left: 116 }, tableWidth: 80, body: [
      [{ content: "Net amount paid", styles: { fontStyle: "bold" } }, { content: t(formatMoney(s.netPay, { currency: s.currency })), styles: { fontStyle: "bold" } }],
    ], columnStyles: { 0: { cellWidth: 34, ...label }, 1: { cellWidth: 46, halign: "right" } } });
  } else {
    autoTable(doc, { ...table, startY: y, head: [[`FINAL PAY (${s.finalMonth})`]], body: [
      [t(`Not paid yet: the gratuity is paid with the ${s.finalMonth} payroll.`)],
    ] });
  }
  y = tableEnd() + 10;

  if (y > height - 45) {
    doc.addPage();
    y = 20;
  }
  const boxWidth = (width - margin * 2 - 6) / 2;
  [`For ${companyName}`, "Received by the employee"].forEach((title, i) => {
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
    doc.text("Date:", x + 3, y + 27);
  });

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.line(margin, height - 13, width - margin, height - 13);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text(t(`${companyName} · ${companyAddressLines(company).join(", ")}`), margin, height - 8);
    doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, width - margin, height - 8, { align: "right" });
  }
  return doc.output("blob");
}

/** Downloads the statement. */
export async function downloadSettlement(s: SettlementStatement): Promise<void> {
  const blob = await settlementPdf(s);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `final-settlement-${(s.employeeCode || String(s.employeeId)).replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
