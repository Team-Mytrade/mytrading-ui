import type { HelpFlowExample } from "../types";

// One sample case through each flow (flows.ts), one line per step in step order. Sample data: Gulf Electronics
// Trading LLC (tools/demo-data), the same documents the page examples use.
export const FLOW_EXAMPLES: Record<string, HelpFlowExample> = {
  "lead-to-order": {
    story: "Hive Coworking Spaces needs 40 laptops for a new branch.",
    steps: [
      "Maria records the lead: Hive Coworking Spaces · Sameer Qureshi · sameer@hive-cowork.test.",
      "After a call she sets it to Contacted, then Qualified (budget confirmed, delivery in 2 weeks).",
      "Deal: Hive – 40 ThinkPads · AED 147,960 · expected close 30 Nov.",
      "Convert to customer: Hive Coworking Spaces, NET30, credit limit AED 150,000.",
      "QT-2026-0047: 40 × Lenovo ThinkPad E14 @ 3,699, 3% discount = AED 143,521.20 + VAT 7,176.06.",
      "Hive accepts; the quotation becomes sales order SO-2026-0129 for AED 150,697.26.",
    ],
  },
  "order-to-cash": {
    story: "Emirates IT Mart's order for 10 ThinkPads, from confirmation to payment.",
    steps: [
      "Ahmed confirms SO-2026-0117 (AED 38,839.50); 10 laptops are reserved in Jebel Ali.",
      "The warehouse dispatches all 10 on 14 Nov; stock drops from 34 to 24.",
      "Fatima issues INV-2026-00318: AED 36,990 + VAT 1,849.50, due 14 Dec.",
      "The customer pays by transfer on 2 Dec; RCPT-2026-0211 settles the invoice.",
    ],
  },
  "delivery-run": {
    story: "Delivering SO-2026-0117 to Emirates IT Mart in Bur Dubai with the company van.",
    steps: [
      "DO-2026-0076 for 15 Nov morning, van D-48213, driver Suresh Pillai.",
      "DN-2026-0081 printed: 10 × ThinkPad E14 in 2 cartons.",
      "Suresh starts the trip at 08:05 in Driver Mode.",
      "Logistics sees the van on Sheikh Zayed Road; Emirates IT Mart is the first stop.",
      "Imran Siddiqui signs for 10 of 10 at 09:40.",
      "Finance invoices the dispatch: INV-2026-00318, AED 38,839.50.",
    ],
  },
  "procure-to-pay": {
    story: "Restocking 50 Galaxy A55 phones from Samsung Gulf.",
    steps: [
      "Aisha raises PR-2026-0031: 50 × Galaxy A55, needed by 25 Nov.",
      "The purchase manager approves the requisition.",
      "PO-2026-0088 to Samsung Gulf: 50 × 1,050 = AED 52,500 + VAT 2,625 = AED 55,125.",
      "48 phones arrive; GRN-2026-0102 puts them into Jebel Ali stock.",
      "Bill SGE/INV/77120 for AED 52,920 is matched to the receipt.",
      "After the AED 2,205 debit note for 2 damaged phones, AED 50,715 is paid.",
    ],
  },
  "month-end": {
    story: "Closing November 2026.",
    steps: [
      "Emirates NBD statement AED 284,115.20 agrees with books AED 268,627.70 plus the uncleared cheque.",
      "Creek Side's post-dated cheque (AED 4,725, 10 Dec) stays open; two cheques cleared this month.",
      "Depreciation: AED 2,200 for the van and AED 1,150 for office equipment.",
      "Rahul's commission AED 3,686 approved for December payroll.",
      "The USD 37,900 letter of credit is revalued at 3.6725.",
      "Net profit AED 19,480; the balance sheet balances.",
      "VAT for the quarter: AED 20,590 due; November is locked.",
    ],
  },
  "purchase-returns": {
    story: "Two Galaxy A55 phones from GRN-2026-0102 arrived with cracked screens.",
    steps: [
      "PRT-2026-0005: 2 × Galaxy A55, reason Damaged in transit.",
      "The phones go back to Samsung Gulf and leave Jebel Ali stock.",
      "Debit note AED 2,205 (2,100 + VAT 105) reduces what is owed to Samsung.",
      "Or: Samsung sends 2 new phones instead, received against the same return.",
    ],
  },
  "leave-to-approval": {
    story: "Joseph D'Souza takes annual leave over Christmas week.",
    steps: [
      "Joseph applies for annual leave 21–25 Dec 2026: 5 working days.",
      "His manager approves it from the Manager Leave Dashboard.",
      "His balance goes from 22 to 17 days; the calendar shows him away.",
      "HR locks December once all requests are settled.",
      "Payroll pays the 5 days as paid leave: no deduction.",
    ],
  },
  "monthly-payroll": {
    story: "Paying 54 employees for November 2026.",
    steps: [
      "HR locks November attendance: 0 open requests.",
      "The run for 54 employees: gross AED 486,400, deductions 3,850, net AED 482,550.",
      "The finance manager approves the run.",
      "It posts to the books; the bank transfer of AED 482,550 is recorded.",
      "54 payslips are emailed as PDFs.",
      "The WPS SIF file goes to the bank.",
      "Maria D'Souza's full & final of AED 19,190 is paid separately.",
    ],
  },
  "company-setup": {
    story: "Gulf Electronics Trading LLC starts on MyTrading on 1 November 2026.",
    steps: [
      "Company profile: Al Fahidi Tower, Dubai · TRN 100458712300003 · AED · VAT 5%.",
      "Chart of accounts started from the standard list; 6450 Marketplace fees added.",
      "Emirates NBD current account and a petty cash box are added.",
      "8 products, 5 customers, 5 vendors and opening stock (AED 106,660) are imported.",
      "Roles: a Manager and an Executive role for each module.",
      "Users are invited: sales.manager@gulf-electronics.test and others.",
    ],
  },
  "hire-to-pay": {
    story: "Joseph D'Souza joins the warehouse on 1 December 2026.",
    steps: [
      "Employee EMP-0059, Warehouse, Inventory Executive, joining 01 Dec 2026.",
      "Pay: basic 4,800 + housing 2,000 + transport 1,200 = AED 8,000 a month.",
      "General shift 09:00–18:00, weekly off Saturday and Sunday, UAE leave policy.",
      "December payroll includes Joseph for the full month.",
      "His first payslip shows net AED 8,000 (no deductions).",
    ],
  },
  "pos-day": {
    story: "A Saturday at the Deira showroom till.",
    steps: [
      "Till 1 is set up for the Deira Showroom Store, cash and card.",
      "Omar opens the shift at 10:00 with a float of AED 500.",
      "First sale: Galaxy A55 + Anker charger = AED 1,635.90, paid in cash.",
      "A customer returns a mouse bought yesterday: AED 397.95 refunded to card.",
      "At 22:00 Omar counts AED 6,240 cash against AED 6,240 expected and closes.",
    ],
  },
  "sales-returns": {
    story: "Al Noor Electronics Retail returns two faulty speakers.",
    steps: [
      "RR-2026-0009: 2 × JBL Flip 6 from INV-2026-00305, not charging.",
      "Ahmed approves it; the speakers come back into stock as returned.",
      "Refund RF-2026-0006: AED 942.90 by bank transfer.",
      "Or: Al Noor takes 2 new speakers instead, at no charge.",
    ],
  },
};
