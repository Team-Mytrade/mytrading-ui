import type { HelpExample, SampleCompany } from "../types";
import { GENERAL_EXAMPLES } from "./general";
import { COMMON_EXAMPLES } from "./common";
import { CRM_EXAMPLES } from "./crm";
import { SALES_EXAMPLES } from "./sales";
import { PURCHASE_EXAMPLES } from "./purchase";
import { INVENTORY_EXAMPLES } from "./inventory";
import { DELIVERY_EXAMPLES } from "./delivery";
import { INVOICE_EXAMPLES } from "./invoice";
import { HR_EXAMPLES } from "./hr";
import { ATTENDANCE_EXAMPLES } from "./attendance";
import { REPORT_EXAMPLES } from "./reports";
import { FLOW_EXAMPLES } from "./flows";

// Worked examples for every page and flow, with the demo companies' data (tools/demo-data/demo-companies.cjs), so what
// the help shows is what a demo company has on screen. Arabic: src/help/ar/examples. Checked by
// scripts/check-help-arabic.cjs (every topic and flow has one, and its Arabic matches its shape).

export const SAMPLE_COMPANIES: Record<SampleCompany, { name: string; place: string; currency: string }> = {
  GET: { name: "Gulf Electronics Trading LLC", place: "Dubai, UAE", currency: "AED" },
  ABM: { name: "Al Bina Building Materials Co.", place: "Riyadh, Saudi Arabia", currency: "SAR" },
  SAP: { name: "Speedline Auto Parts Pvt Ltd", place: "Chennai, India", currency: "INR" },
};

export const HELP_EXAMPLES: Record<string, HelpExample> = {
  ...GENERAL_EXAMPLES,
  ...COMMON_EXAMPLES,
  ...CRM_EXAMPLES,
  ...SALES_EXAMPLES,
  ...PURCHASE_EXAMPLES,
  ...INVENTORY_EXAMPLES,
  ...DELIVERY_EXAMPLES,
  ...INVOICE_EXAMPLES,
  ...HR_EXAMPLES,
  ...ATTENDANCE_EXAMPLES,
  ...REPORT_EXAMPLES,
};

export { FLOW_EXAMPLES };
