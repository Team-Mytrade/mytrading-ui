import type { HelpExample } from "../types";

// Examples for Finance (topics/invoice.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data); ZATCA uses
// Al Bina Building Materials (Saudi Arabia). Main case: INV-2026-00318, Emirates IT Mart, AED 38,839.50.
export const INVOICE_EXAMPLES: Record<string, HelpExample> = {
  invoices: {
    story: "Fatima invoices the 10 ThinkPads delivered to Emirates IT Mart.",
    data: [
      { label: "Invoice", value: "INV-2026-00318 (from dispatch of SO-2026-0117)" },
      { label: "Date / due", value: "14 Nov 2026 / 14 Dec 2026 (NET30)" },
      { label: "Subtotal", value: "AED 36,990.00" },
      { label: "VAT 5%", value: "AED 1,849.50" },
      { label: "Total", value: "AED 38,839.50" },
    ],
    result: "Issuing it posts the sale and VAT and adds AED 38,839.50 to the customer's balance.",
  },
  "recurring-invoices": {
    story: "Smart Office Solutions pays a monthly IT support fee.",
    data: [
      { label: "Template", value: "IT support – Smart Office Solutions" },
      { label: "Line", value: "Monthly support contract · AED 2,500 + VAT" },
      { label: "Every", value: "Month, on the 1st" },
      { label: "Next", value: "01 Dec 2026" },
    ],
    result: "An invoice for AED 2,625 is made and issued on the 1st of every month.",
  },
  "payment-receipts": {
    story: "Emirates IT Mart pays the laptop invoice by bank transfer.",
    data: [
      { label: "Receipt", value: "RCPT-2026-0211" },
      { label: "Customer", value: "Emirates IT Mart" },
      { label: "Amount", value: "AED 38,839.50" },
      { label: "Into", value: "Emirates NBD current account" },
      { label: "Applied to", value: "INV-2026-00318" },
    ],
    result: "The invoice becomes Paid and the customer's balance drops to zero.",
  },
  "accounts-receivable": {
    story: "Finance reviews who owes money at month-end.",
    data: [
      { label: "Emirates IT Mart", value: "AED 38,839.50 · 1–30 days" },
      { label: "Bluewave Telecom LLC", value: "AED 12,410 · 31–60 days" },
      { label: "Creek Side Computers", value: "AED 4,725 · not due" },
      { label: "Total", value: "AED 55,974.50" },
    ],
    result: "Finance sends Bluewave a statement and a reminder.",
  },
  "export-evidence": {
    story: "Laptops sold to a customer in Oman were invoiced with 0% VAT; proof of export is needed.",
    data: [
      { label: "Invoice", value: "INV-2026-00322 · Muscat Digital LLC" },
      { label: "Exit document", value: "Customs exit cert. DXB-EX-2026-88211" },
      { label: "Date of exit", value: "16 Nov 2026" },
    ],
    result: "The zero-rated sale is backed by evidence if the tax authority asks.",
  },
  "sales-commission": {
    story: "Rahul earns 2% of what his customers paid in November.",
    data: [
      { label: "Sales person", value: "Rahul Menon" },
      { label: "Collected in November", value: "AED 184,300" },
      { label: "Rate", value: "2%" },
      { label: "Commission", value: "AED 3,686" },
    ],
    result: "Approved, it is paid with his December salary.",
  },
  "marketplace-payouts": {
    story: "noon pays out a week of marketplace sales, less its fees.",
    data: [
      { label: "Payout", value: "noon · 10–16 Nov 2026" },
      { label: "Sales", value: "AED 6,842.50 (14 orders)" },
      { label: "Fees", value: "AED 821.10" },
      { label: "Paid to bank", value: "AED 6,021.40" },
    ],
    result: "The 14 invoices are marked paid and the fees go to marketplace expenses.",
  },
  "purchase-invoices": {
    story: "Samsung Gulf's bill arrives for the 48 phones received.",
    data: [
      { label: "Bill", value: "SGE/INV/77120 (GRN-2026-0102)" },
      { label: "Vendor", value: "Samsung Gulf Electronics FZE" },
      { label: "Amount", value: "48 × 1,050 = AED 50,400 + VAT 2,520" },
      { label: "Total", value: "AED 52,920" },
      { label: "Due", value: "29 Dec 2026 (NET45)" },
    ],
    result: "The bill is matched to the receipt and AED 52,920 is owed to Samsung.",
  },
  "bill-reader": {
    story: "Fatima uploads a PDF bill instead of typing it in.",
    data: [
      { label: "File", value: "ingram-INV-554018.pdf" },
      { label: "Read as", value: "Ingram Micro Gulf FZE · 554018 · 12 Nov 2026" },
      { label: "Lines", value: "5 × Lenovo ThinkPad E14 @ 2,950" },
      { label: "Total", value: "AED 15,487.50" },
    ],
    result: "She checks the filled-in bill and saves it; nothing is saved until she does.",
  },
  "vendor-payments": {
    story: "Finance pays Samsung Gulf's bill, less the returned phones.",
    data: [
      { label: "Bill", value: "SGE/INV/77120 · AED 52,920" },
      { label: "Debit note", value: "PRT-2026-0005 · −AED 2,205" },
      { label: "Paid", value: "AED 50,715 by transfer" },
      { label: "Approval", value: "Finance Manager (over AED 50,000)" },
    ],
    result: "After approval the payment posts and the bill is settled.",
  },
  "accounts-payable": {
    story: "Finance plans this week's payments.",
    data: [
      { label: "Samsung Gulf Electronics FZE", value: "AED 50,715 · due 29 Dec" },
      { label: "Ingram Micro Gulf FZE", value: "AED 15,487.50 · overdue 3 days" },
      { label: "Total owed", value: "AED 66,202.50" },
    ],
    result: "Ingram is paid first because it is overdue.",
  },
  "bank-cash": {
    story: "Finance matches the bank statement to the books.",
    data: [
      { label: "Account", value: "Emirates NBD current account" },
      { label: "Statement balance", value: "AED 284,115.20" },
      { label: "Not yet on statement", value: "Cheque 000184 to Ingram · AED 15,487.50" },
      { label: "Book balance", value: "AED 268,627.70" },
    ],
    result: "The difference is explained by the uncleared cheque, so the account is reconciled.",
  },
  cheques: {
    story: "Creek Side Computers pays with a cheque dated next month.",
    data: [
      { label: "Cheque", value: "Mashreq 004512" },
      { label: "Amount", value: "AED 4,725" },
      { label: "Cheque date", value: "10 Dec 2026" },
      { label: "Status", value: "Post-dated → Deposited → Cleared" },
    ],
    result: "It counts as paid only when it clears; if it bounces, the invoice opens again.",
  },
  "cash-flow-forecast": {
    story: "Finance looks at the next 30 days.",
    data: [
      { label: "Opening bank", value: "AED 268,627.70" },
      { label: "Expected in", value: "AED 55,974.50 (customer invoices)" },
      { label: "Expected out", value: "AED 66,202.50 (vendor bills)" },
      { label: "Closing", value: "AED 258,399.70" },
    ],
    result: "Enough cash to pay every bill on time; no payment needs delaying.",
  },
  "letters-of-credit": {
    story: "A large laptop import is paid by letter of credit.",
    data: [
      { label: "LC", value: "ENBD-LC-2026-0193" },
      { label: "Beneficiary", value: "Redington Gulf FZE" },
      { label: "Amount", value: "USD 37,900" },
      { label: "Expiry", value: "31 Jan 2027" },
    ],
    result: "When the bank pays Redington, the payment closes PO-2026-0091's bill.",
  },
  "journal-entries": {
    story: "Finance books the office rent accrual for November.",
    data: [
      { label: "Debit", value: "6100 · Rent expense · AED 15,000" },
      { label: "Credit", value: "2200 · Accrued expenses · AED 15,000" },
      { label: "Narration", value: "Al Fahidi Tower office rent, Nov 2026" },
    ],
    result: "Debits equal credits, so the entry posts.",
  },
  "general-ledger": {
    story: "Finance reads the sales account for November.",
    data: [
      { label: "Account", value: "4000 · Sales" },
      { label: "Opening", value: "AED 0" },
      { label: "Postings", value: "142 entries · AED 412,580" },
      { label: "Closing", value: "AED 412,580 Cr" },
    ],
    result: "Clicking INV-2026-00318's line opens the invoice behind it.",
  },
  "financial-statements": {
    story: "Management reviews November's profit.",
    data: [
      { label: "Revenue", value: "AED 412,580" },
      { label: "Cost of goods sold", value: "AED 331,900" },
      { label: "Gross profit", value: "AED 80,680 (19.6%)" },
      { label: "Expenses", value: "AED 61,200" },
      { label: "Net profit", value: "AED 19,480" },
    ],
    result: "The balance sheet balances and the figures can be exported to Excel or PDF.",
  },
  "fixed-assets": {
    story: "The new delivery van is recorded as an asset.",
    data: [
      { label: "Asset", value: "Toyota Hiace van D-51907" },
      { label: "Cost", value: "AED 132,000" },
      { label: "Life", value: "5 years, straight line" },
      { label: "Monthly depreciation", value: "AED 2,200" },
    ],
    result: "Running depreciation each month posts AED 2,200 to depreciation expense.",
  },
  budgets: {
    story: "Finance compares marketing spend with the budget.",
    data: [
      { label: "Account", value: "6400 · Marketing" },
      { label: "Budget Nov", value: "AED 12,000" },
      { label: "Actual Nov", value: "AED 14,350" },
      { label: "Variance", value: "AED 2,350 over (19.6%)" },
    ],
    result: "The over-spend is flagged for the management meeting.",
  },
  "expense-revenue": {
    story: "The office pays its DEWA electricity bill.",
    data: [
      { label: "Type", value: "Expense" },
      { label: "Account", value: "6200 · Utilities" },
      { label: "Amount", value: "AED 2,940 + VAT 147" },
      { label: "Paid from", value: "Emirates NBD current account" },
    ],
    result: "It posts at once: utilities up, bank down, VAT recoverable recorded.",
  },
  "tax-records": {
    story: "Finance checks November's VAT before filing.",
    data: [
      { label: "Output VAT", value: "AED 20,629.00" },
      { label: "Input VAT", value: "AED 13,940.40" },
      { label: "Net payable", value: "AED 6,688.60" },
    ],
    result: "These figures feed the VAT Return for the quarter.",
  },
  "chart-of-accounts": {
    story: "Finance adds an account for marketplace fees.",
    data: [
      { label: "Code", value: "6450" },
      { label: "Name", value: "Marketplace fees" },
      { label: "Type", value: "Expense" },
      { label: "Under", value: "6400 · Selling expenses" },
    ],
    result: "noon and Amazon fees can now be posted to 6450.",
  },
  "posting-accounts": {
    story: "At month-end, finance locks October so no one changes it.",
    data: [
      { label: "Locked up to", value: "31 Oct 2026" },
      { label: "Payment approval limit", value: "AED 50,000" },
      { label: "Sales posts to", value: "4000 · Sales" },
    ],
    result: "Any attempt to post into October is refused.",
  },
  "exchange-rates": {
    story: "A USD bill is due; finance enters today's rate.",
    data: [
      { label: "Currency", value: "USD → AED" },
      { label: "Rate", value: "3.6725" },
      { label: "Date", value: "13 Nov 2026" },
    ],
    result: "The USD 37,900 LC shows as AED 139,187.75 in the books.",
  },
  "cost-centres": {
    story: "Costs are split between the warehouse and the showroom.",
    data: [
      { label: "Cost centres", value: "JAFZ Operations, Deira Showroom" },
      { label: "Example posting", value: "DEWA bill AED 2,940 → Deira Showroom" },
    ],
    result: "Reports show each location's own expenses.",
  },
  zatca: {
    company: "ABM",
    story: "Al Bina in Riyadh sends its invoices to ZATCA (Fatoora).",
    data: [
      { label: "Invoice", value: "INV-2026-00451 · AlRajhi Contracting" },
      { label: "Total", value: "SAR 28,750 incl. VAT 15%" },
      { label: "Status", value: "Cleared by ZATCA" },
      { label: "QR code", value: "Printed on the invoice" },
    ],
    result: "The invoice carries ZATCA's stamp and QR code; it can't be changed after clearing.",
  },
  "uae-einvoicing": {
    story: "Gulf Electronics sends its invoices through its accredited service provider.",
    data: [
      { label: "Provider", value: "Accredited ASP (connected)" },
      { label: "Invoice", value: "INV-2026-00318" },
      { label: "Status", value: "Sent · accepted" },
    ],
    result: "Emirates IT Mart receives the e-invoice through the UAE network.",
  },
};
