// The company on a simple PDF report: a thin strip in its colour across the top, and its logo (else its name) at
// the top right, where the reports leave room beside their title.
import type { jsPDF } from "jspdf";
import { loadCompany, loadCompanyLogo } from "./companyApi";
import { brandShade } from "./brand";

const BOX_WIDTH = 40;
const BOX_HEIGHT = 12;

export const stampCompany = async (doc: jsPDF) => {
  const [company, logo] = await Promise.all([loadCompany(), loadCompanyLogo()]);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFillColor(...brandShade(600));
    doc.rect(0, 0, pageWidth, 2, "F");
    if (page > 1) continue;
    if (logo) {
      const scale = logo.width && logo.height ? Math.min(BOX_WIDTH / logo.width, BOX_HEIGHT / logo.height) : 1;
      const width = logo.width ? logo.width * scale : BOX_WIDTH;
      const height = logo.height ? logo.height * scale : BOX_HEIGHT;
      doc.addImage(logo.dataUrl, logo.format, pageWidth - 14 - width, 5, width, height);
    } else if (company?.companyName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...brandShade(700));
      doc.text(company.legalName || company.companyName, pageWidth - 14, 11, { align: "right" });
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
    }
  }
};
