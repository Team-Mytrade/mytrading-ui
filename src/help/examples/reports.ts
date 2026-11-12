import type { HelpExample } from "../types";

// Examples for the reports (Reports topics in topics/general.ts). Sample data: Gulf Electronics Trading LLC,
// November 2026, matching the other examples (INV-2026-00318, PO-2026-0088 …).
export const REPORT_EXAMPLES: Record<string, HelpExample> = {
  "report-center": {
    story: "Fatima needs last month's sales by customer.",
    data: [
      { label: "Family", value: "Sales" },
      { label: "Report", value: "Sales Register" },
      { label: "Period", value: "1 – 30 Nov 2026" },
    ],
    result: "The report opens with a filter bar, Excel, PDF and Print.",
  },
  "sales-register": {
    story: "Every sales invoice for November, one line each.",
    data: [
      { label: "INV-2026-00318", value: "14 Nov · Emirates IT Mart · AED 38,839.50" },
      { label: "INV-2026-00322", value: "16 Nov · Muscat Digital LLC · AED 18,495.00 (0% VAT)" },
      { label: "Total for November", value: "142 invoices · AED 412,580 before VAT" },
    ],
    result: "Exported to Excel for the auditors.",
  },
  "sales-analysis": {
    story: "Ahmed looks at November sales by category.",
    data: [
      { label: "Laptops & Computers", value: "AED 248,950 (60%)" },
      { label: "Mobiles & Tablets", value: "AED 121,300 (29%)" },
      { label: "Accessories", value: "AED 42,330 (11%)" },
    ],
    result: "Laptops drive the month; accessories are the place to grow.",
  },
  "open-orders": {
    story: "What has been ordered but not yet delivered.",
    data: [
      { label: "SO-2026-0124", value: "Emirates IT Mart · 7 × Galaxy A55 · on credit hold" },
      { label: "SO-2026-0126", value: "Bluewave Telecom · 20 × Anker charger · 12 left to send" },
    ],
    result: "The warehouse knows what to prepare next.",
  },
  "dispatched-not-invoiced": {
    story: "Finance looks for goods that left without an invoice.",
    data: [
      { label: "Dispatch", value: "SO-2026-0126 · 8 × Anker 65W Charger · 18 Nov" },
      { label: "Value", value: "AED 1,335.60" },
    ],
    result: "Fatima invoices it straight from the report.",
  },
  "quotation-conversion": {
    story: "How many quotations became orders in November.",
    data: [
      { label: "Quotations", value: "18 · AED 512,000" },
      { label: "Became orders", value: "11 · AED 318,400" },
      { label: "Conversion", value: "61% by count · 62% by value" },
    ],
    result: "Rahul converts best: 5 of his 6 quotations were won.",
  },
  "returns-refunds": {
    story: "November's returns, by reason.",
    data: [
      { label: "RR-2026-0009", value: "Al Noor · 2 × JBL Flip 6 · defective · AED 942.90 refunded" },
      { label: "Total returns", value: "3 · AED 2,310.40" },
    ],
    result: "Most returns are speakers; quality is raised with the vendor.",
  },
  "gross-margin": {
    story: "Finance checks the margin on November's sales.",
    data: [
      { label: "Lenovo ThinkPad E14", value: "Sold 3,699 · cost 2,950 · margin 20.2%" },
      { label: "Anker 65W Charger", value: "Sold 159 · cost 95 · margin 40.3%" },
      { label: "Whole month", value: "AED 80,680 · 19.6%" },
    ],
    result: "Accessories earn the highest margin per sale.",
  },
  "purchase-register": {
    story: "Every vendor bill for November.",
    data: [
      { label: "SGE/INV/77120", value: "Samsung Gulf · AED 52,920" },
      { label: "554018", value: "Ingram Micro Gulf · AED 15,487.50" },
      { label: "Total", value: "AED 298,744.50" },
    ],
    result: "Matched against the VAT input claimed.",
  },
  "purchase-analysis": {
    story: "Who the company bought the most from this quarter.",
    data: [
      { label: "Samsung Gulf Electronics FZE", value: "AED 214,300" },
      { label: "Ingram Micro Gulf FZE", value: "AED 168,900" },
      { label: "Redington Gulf FZE", value: "AED 139,200" },
    ],
    result: "Purchase uses it to negotiate better terms with Samsung.",
  },
  "open-purchase-orders": {
    story: "What has been ordered from vendors but not yet arrived.",
    data: [
      { label: "PO-2026-0088", value: "Samsung Gulf · 2 of 50 Galaxy A55 still to come" },
      { label: "PO-2026-0091", value: "Redington · 40 HP ProBook · at sea, ETA 28 Nov" },
    ],
    result: "Sales can promise dates based on what's on the way.",
  },
  "received-not-billed": {
    story: "Goods received but no vendor bill yet.",
    data: [
      { label: "GRN-2026-0110", value: "30 × Dell 27\" Monitor · AED 29,400 · 9 days" },
    ],
    result: "Finance asks Redington for the missing bill.",
  },
  "vendor-performance": {
    story: "How reliable the vendors were this quarter.",
    data: [
      { label: "Samsung Gulf", value: "On time 92% · returns 4%" },
      { label: "Ingram Micro Gulf", value: "On time 98% · returns 0%" },
    ],
    result: "Ingram is preferred for urgent orders.",
  },
  "day-book": {
    story: "Everything posted on 14 November.",
    data: [
      { label: "INV-2026-00318", value: "Sales AED 36,990 · VAT 1,849.50" },
      { label: "RCPT-2026-0209", value: "Bluewave Telecom · AED 8,200" },
      { label: "Entries that day", value: "23" },
    ],
    result: "Finance checks the day was posted completely.",
  },
  "cash-bank-book": {
    story: "Money in and out of the main bank account in November.",
    data: [
      { label: "Account", value: "Emirates NBD current account" },
      { label: "Opening", value: "AED 241,380.40" },
      { label: "In / out", value: "AED 402,118.00 / AED 374,870.70" },
      { label: "Closing", value: "AED 268,627.70" },
    ],
    result: "The closing matches the reconciled bank balance.",
  },
  "receipts-payments": {
    story: "Where November's money came from and went.",
    data: [
      { label: "Received from customers", value: "AED 402,118" },
      { label: "Paid to vendors", value: "AED 284,920" },
      { label: "Paid for expenses", value: "AED 89,950.70" },
    ],
    result: "More came in than went out this month.",
  },
  "customer-ledger": {
    story: "Everything with Emirates IT Mart this year.",
    data: [
      { label: "14 Nov", value: "INV-2026-00318 · Dr 38,839.50" },
      { label: "02 Dec", value: "RCPT-2026-0211 · Cr 38,839.50" },
      { label: "Balance", value: "AED 0" },
    ],
    result: "Sent to the customer as a statement.",
  },
  "vendor-ledger": {
    story: "Everything with Samsung Gulf this year.",
    data: [
      { label: "Bill SGE/INV/77120", value: "Cr 52,920" },
      { label: "Debit note PRT-2026-0005", value: "Dr 2,205" },
      { label: "Payment", value: "Dr 50,715" },
      { label: "Balance", value: "AED 0" },
    ],
    result: "Agrees with Samsung's own statement.",
  },
  "expenses-by-account": {
    story: "November's expenses by account.",
    data: [
      { label: "6000 Salaries", value: "AED 486,400" },
      { label: "6100 Rent", value: "AED 15,000" },
      { label: "6200 Utilities", value: "AED 2,940" },
      { label: "6400 Marketing", value: "AED 14,350" },
    ],
    result: "Marketing is over budget this month.",
  },
  headcount: {
    story: "How many people work where.",
    data: [
      { label: "Total", value: "54" },
      { label: "Joined in November", value: "2 (Omar Haddad, Joseph D'Souza)" },
      { label: "Left in November", value: "1 (Maria D'Souza)" },
    ],
    result: "Headcount is up by one on October.",
  },
  "payroll-register": {
    story: "Each employee's pay for November.",
    data: [
      { label: "Joseph D'Souza", value: "Gross 8,000 · deductions 266.67 · net 7,733.33" },
      { label: "Totals", value: "Gross 486,400 · net 482,550" },
    ],
    result: "Matches the payroll run and the WPS file.",
  },
  "leave-balances": {
    story: "Who has leave left at the end of November.",
    data: [
      { label: "Joseph D'Souza", value: "Annual 22 · sick 15" },
      { label: "Fatima Khan", value: "Annual 8 · sick 12" },
    ],
    result: "HR reminds Fatima to plan her leave before carry-forward limits apply.",
  },
  "stock-aging": {
    story: "How long stock has been sitting.",
    data: [
      { label: "Dell 27\" Monitor P2723D", value: "6 units over 120 days" },
      { label: "Value over 90 days", value: "AED 14,720" },
    ],
    result: "Sales runs a monitor offer to clear the old units.",
  },
  "abc-analysis": {
    story: "Which products matter most by sales value.",
    data: [
      { label: "A (70% of value)", value: "ThinkPad E14, HP ProBook, Galaxy A55" },
      { label: "B (20%)", value: "iPad, Dell Monitor" },
      { label: "C (10%)", value: "Mouse, Charger, Speaker" },
    ],
    result: "A items get the tightest stock checks and reorder levels.",
  },
  "inventory-report": {
    story: "The warehouse manager needs stock value by warehouse.",
    data: [
      { label: "Jebel Ali Main Warehouse", value: "AED 612,450" },
      { label: "Deira Showroom Store", value: "AED 48,230" },
    ],
    result: "Exported as PDF for the insurance renewal.",
  },
  "vat-return": {
    story: "Finance prepares the VAT return for Oct – Dec 2026.",
    data: [
      { label: "Box 1a Standard rated, Dubai", value: "AED 1,184,200 · VAT 59,210" },
      { label: "Box 3 Zero rated", value: "AED 52,300" },
      { label: "Box 9 Standard rated expenses", value: "AED 772,400 · VAT 38,620" },
      { label: "Net VAT due", value: "AED 20,590" },
    ],
    result: "The figures are copied into the FTA EmaraTax portal and the quarter is locked.",
  },
};
