import type { HelpRole, HelpTopic } from "../types";

// Who can do what on the Invoice pages (invoice-service SecurityConfig): INVOICE:APPROVE issues and cancels invoices,
// approves vendor payments over the limit, bounces cheques, cancels our cheques, runs recurring invoices, posts
// marketplace payouts, approves and pays commission and works letters of credit; INVOICE:ADMIN (a finance administrator)
// sets up bank accounts, posting accounts, the lock date, revaluation, year-end close, budgets, cost centres,
// depreciation and disposals, commission rates and e-invoicing; DELETE deletes, EXPORT downloads PDFs.
// The demo Finance Manager has all of them; the Finance Executive has view, create and update.
const FINANCE_WHO: HelpRole[] = [
  { role: "Finance Manager", can: "Everything, including issuing and cancelling invoices, approving, deleting, downloading PDFs and the finance set-up." },
  { role: "Finance Executive", can: "Everyday entries: draft invoices, credit notes, receipts, bills, vendor payments and journal entries. Not issue or cancel invoices, approve, delete or download." },
];

// Set-up pages: a finance administrator changes them, everyone else with Invoice access reads them
const SETUP_WHO = (what: string): HelpRole[] => [
  { role: "Finance Manager", can: `${what} (needs the finance administrator right).` },
  { role: "Finance Executive", can: "See it; not change it." },
];

// Invoice: receivables, payables, banking, accounting and finance set-up (menu: Invoice).
export const INVOICE_TOPICS: HelpTopic[] = [
  /* ================= Receivables ================= */
  {
    id: "invoices",
    route: "/invoices",
    module: "Invoice",
    title: "Invoices",
    summary: "Tax invoices to customers, made from confirmed sales dispatches. Check the draft, issue it (numbered, posted to the ledger, e-invoiced where required) and follow it until it is paid.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Make an invoice",
        steps: [
          "Click Generate invoice and choose the confirmed dispatch. Lines, prices and taxes come from the sales order and dispatch.",
          "Click Create draft. Open the draft to check it; Edit changes the invoice date and remarks.",
        ],
      },
      {
        title: "Issue it",
        who: "Finance Manager",
        steps: ["Open the draft and click Issue invoice. It gets its number, the receivable opens and the entry posts to the ledger.", "Where e-invoicing applies (ZATCA, UAE), the e-invoice is made as it is issued; its status shows on the invoice."],
      },
      {
        title: "Get paid",
        steps: ["Click Record payment: Payment Receipts opens for this invoice.", "Send payment reminder emails the customer (they need an email address)."],
      },
      {
        title: "Correct an issued invoice",
        steps: [
          "Click Credit note: enter the Amount, the Type (Sales return, Price adjustment or Discount) and the Reason, then Issue credit note.",
          "It comes off the balance at once; anything beyond the balance goes to the customer's credit.",
          "Apply credit uses the customer's unused credit (an advance, an overpayment or a credit note) on this invoice.",
        ],
      },
      {
        title: "Cancel it",
        who: "Finance Manager",
        steps: ["While nothing is paid, click Cancel invoice and give the reason. The receivable is closed and the invoice stays on record as cancelled."],
      },
      { title: "Print it", steps: ["Click Download PDF (needs the export right)."] },
    ],
    fields: [
      { name: "Sales person", meaning: "Earns the sales commission on the invoice; it comes from the sales order. Change sets another one." },
      { name: "Balance due", meaning: "What is still to be paid after payments, credit notes and credits." },
    ],
    statuses: [
      { name: "Draft", meaning: "Made, not issued; can be edited or deleted." },
      { name: "Issued", meaning: "Numbered and posted; waiting for payment." },
      { name: "Partially Paid", meaning: "Part of it has been paid." },
      { name: "Overdue", meaning: "Past its due date and not fully paid." },
      { name: "Paid", meaning: "Fully paid or credited." },
      { name: "Cancelled", meaning: "Cancelled before any payment; kept on record." },
    ],
    rules: [
      "Invoices come only from confirmed sales dispatches; each dispatch is invoiced once.",
      "Only drafts can be edited or deleted (Delete draft: Finance Manager).",
      "An invoice in another currency is booked at the rate of its date; the rate shows under the totals.",
      "Nothing dated in a locked period can be posted, changed or cancelled.",
    ],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/paymentReceipts", label: "Payment Receipts" },
      { route: "/accountsReceivable", label: "Accounts Receivable" },
      { route: "/recurringInvoices", label: "Recurring Invoices" },
    ],
    flows: ["order-to-cash", "delivery-run"],
  },
  {
    id: "recurring-invoices",
    route: "/recurringInvoices",
    module: "Invoice",
    title: "Recurring Invoices",
    summary: "Invoices that repeat on a schedule, such as rent, maintenance contracts or subscriptions. Services only: nothing leaves the stock.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Set one up",
        steps: [
          "Click New recurring invoice.",
          "Enter the Name (e.g. Office rent), choose the Customer, how often (Every), the Credit days and the First invoice on date; Last invoice by is optional. Leave Currency blank to use the customer's.",
          "Add the lines: Description, Qty, Price and Tax % (Add line for more).",
          "Tick Issue each invoice straight away, or leave it to make drafts you check and issue. Save.",
        ],
      },
      { title: "Stop for a while", steps: ["Click Pause on the row; Resume starts it again."] },
      { title: "Make what is due now", who: "Finance Manager", steps: ["Click Create due invoices now instead of waiting for the hourly check."] },
    ],
    statuses: [
      { name: "Active", meaning: "Makes its invoice on each next date." },
      { name: "Paused", meaning: "Makes nothing until resumed." },
      { name: "Ended", meaning: "Past its last date." },
    ],
    rules: [
      "Due invoices are checked every hour; missed periods are caught up.",
      "The customer's details are taken when you save; later invoices are made from them.",
      "Deleting stops new invoices; the ones it made stay.",
      "The Last run failed card lists the ones whose invoice couldn't be made.",
    ],
    related: [{ route: "/invoices", label: "Invoices" }],
  },
  {
    id: "payment-receipts",
    route: "/paymentReceipts",
    module: "Invoice",
    title: "Payment Receipts",
    summary: "Money received from customers, allocated to their open invoices. Anything left over is kept as an advance they can use later.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Record a payment",
        steps: [
          "Click Record payment (or Record payment on an invoice).",
          "Choose the Customer and enter the Amount received, Currency, Payment date, Method and Deposit to.",
          "Under Open invoices, click Allocate oldest first or enter what each invoice gets.",
          "Save. The invoices are paid; the rest is kept as an advance.",
        ],
      },
      {
        title: "A cheque dated later",
        steps: ["Choose cheque as the method and enter the Cheque date and Drawn on (bank).", "Dated after the payment date, it is post-dated: the invoices are settled now and the cheque waits on Cheques until it clears or bounces."],
      },
      {
        title: "Undo a payment",
        steps: ["Open the receipt and click Reverse payment, with the reason. For a bounced cheque or a payment recorded by mistake: the invoices it paid become due again and any advance it created is cancelled."],
      },
    ],
    statuses: [
      { name: "Posted", meaning: "Counted against the invoices." },
      { name: "Reversed", meaning: "Undone; the reason and date show on the receipt." },
    ],
    rules: [
      "The allocations can't add up to more than the amount received, nor more than an invoice's balance.",
      "An advance is customer credit: use it with Apply credit on a later invoice.",
    ],
    related: [
      { route: "/invoices", label: "Invoices" },
      { route: "/cheques", label: "Cheques" },
      { route: "/accountsReceivable", label: "Accounts Receivable" },
    ],
    flows: ["order-to-cash"],
  },
  {
    id: "accounts-receivable",
    route: "/accountsReceivable",
    module: "Invoice",
    title: "Accounts Receivable",
    summary: "What customers owe: every issued invoice still open, what is overdue and each customer's unused credit.",
    who: FINANCE_WHO,
    tasks: [
      { title: "See what to collect", steps: ["The cards show Outstanding, Unused credit, Open invoices and Overdue invoices; search by invoice or customer."] },
      { title: "Send a customer statement", steps: ["Click Customer statement on a row.", "Choose From and To and click Show: invoices, payments and credits in the period, with the running balance."] },
    ],
    rules: ["Receivables appear when invoices are issued.", "A customer's credit limit is checked against what they owe here."],
    related: [
      { route: "/paymentReceipts", label: "Payment Receipts" },
      { route: "/credit-limit", label: "Credit Limit" },
    ],
  },
  {
    id: "export-evidence",
    route: "/exportEvidence",
    module: "Invoice",
    title: "Export Evidence",
    summary: "Proof of exit for exports: an export or re-export is zero-rated only when you hold proof the goods left the country within 90 days of the invoice.",
    who: FINANCE_WHO,
    tasks: [
      { title: "Record the proof", steps: ["Click Record proof of exit on the invoice.", "Enter the Document, Document number and Date the goods left, and save."] },
      { title: "See what still needs proof", steps: ["Tick Only those still needing proof."] },
    ],
    statuses: [
      { name: "Proof held", meaning: "Recorded; the zero rate stands." },
      { name: "Proof due", meaning: "Still within the 90 days." },
      { name: "Overdue", meaning: "Past 90 days without proof: taxed at the standard rate." },
    ],
    rules: ["Recording or removing proof needs the Invoice update right."],
    related: [
      { route: "/invoices", label: "Invoices" },
      { route: "/vatReturn", label: "VAT Return" },
    ],
  },
  {
    id: "sales-commission",
    route: "/salesCommission",
    module: "Invoice",
    title: "Sales Commission",
    summary: "Monthly commission statements per sales person: each invoice's sales person earns their rate on its value before tax.",
    who: [
      { role: "Finance Manager", can: "Approve, pay or send statements to payroll, and undo them. The commission rule and rates need the finance administrator right." },
      { role: "Finance Executive", can: "See the statements and rates." },
    ],
    tasks: [
      {
        title: "Set the rates",
        who: "Finance Manager",
        steps: [
          "Under Rates, choose when Commission is earned: as the customer pays (collected) or when the invoice is issued (invoiced).",
          "Click Add rate: the Sales person and/or Product, the Rate %, For invoices from and Notes. Leave both empty for everyone.",
        ],
      },
      { title: "Approve a month", who: "Finance Manager", steps: ["Choose the Month and click Approve on each sales person's statement (Invoices on it shows what it is made of)."] },
      {
        title: "Pay it",
        who: "Finance Manager",
        steps: [
          "Record payment: Paid on, Method, Paid from and Reference (UTR, cheque no.).",
          "Or Pay with salary: choose the Payroll month; it shows on the payslip as Sales commission. The sales person must be linked to an employee (Sales → Sales Persons).",
          "Undo takes an approval or payment back.",
        ],
      },
    ],
    statuses: [
      { name: "To approve", meaning: "Earned this month, not approved yet." },
      { name: "Approved, unpaid", meaning: "Booked as commission owed." },
      { name: "Paid or with salaries", meaning: "Paid, or sent to payroll." },
    ],
    rules: [
      "The most specific rate wins: the sales person on the product, then the product, then the sales person, then everyone.",
      "A statement is what was earned by the month's end less what was approved before, so credit notes, cancelled invoices and bounced receipts come back as negative lines.",
      "A month can be approved once it is over; a month left unapproved rolls into the next one approved.",
      "To change a rate from a date, add a new rate: editing one also changes invoices already approved at it.",
    ],
    related: [
      { route: "/invoices", label: "Invoices" },
      { route: "/payrollEngine", label: "Payroll" },
    ],
  },
  {
    id: "marketplace-payouts",
    route: "/marketplacePayouts",
    module: "Invoice",
    title: "Marketplace Payouts",
    summary: "Payouts from Amazon and noon, sent in from Online Stores. Each order's money is matched to its invoice; posting books the receipts, refunds and fees, so the bank moves by the payout.",
    who: [
      { role: "Finance Manager", can: "Post payouts." },
      { role: "Finance Executive", can: "See and check payouts." },
    ],
    tasks: [
      { title: "Bring a payout in", steps: ["On Online Stores, use Get payouts for Amazon or Upload payout statement for noon."] },
      {
        title: "Post it",
        who: "Finance Manager",
        steps: ["Open the payout and check its lines: each order, refund and fee with its invoice.", "Click Post payout: it goes into the bank account the marketplace pays (or the default bank account)."],
      },
    ],
    statuses: [
      { name: "Ready to post", meaning: "Every line is matched and the lines add up to the payout." },
      { name: "To match", meaning: "Some orders have no invoice yet." },
      { name: "Doesn't add up", meaning: "The lines differ from the amount paid out; check the payout in the marketplace's seller portal." },
      { name: "Posted", meaning: "Receipts, refunds and fees are in the books." },
    ],
    rules: ["A payout can't be posted until its lines add up to the amount paid out."],
    related: [
      { route: "/sales-online-stores", label: "Online Stores" },
      { route: "/bankAccounts", label: "Bank & Cash" },
    ],
  },

  /* ================= Payables ================= */
  {
    id: "purchase-invoices",
    route: "/purchaseInvoices",
    module: "Invoice",
    title: "Purchase Invoices",
    summary: "Vendors' bills: what you owe and when. Bill goods from their goods receipt; enter services and expenses directly.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Bill goods received",
        steps: [
          "Click Bill from GRN and choose the Goods receipt: the amount comes from what was accepted, at the purchase order prices.",
          "Enter the Vendor's invoice number and Invoice date (and the vendor's total, to check), then Record bill.",
        ],
      },
      {
        title: "Enter another bill",
        steps: [
          "Click Add Purchase Invoice.",
          "Choose the Vendor; enter the Vendor's invoice number, Invoice Date, Due Date, Bill amount (incl. tax), VAT and Currency, and a Cost centre if you use them. Save.",
        ],
      },
      { title: "Correct a bill", steps: ["Click Debit note on the bill for a price difference or short supply: Amount, Date and Reason. It reduces what is owed."] },
      { title: "Let AI read the bill", steps: ["Use Read a Vendor Bill to fill a bill in from its PDF or photo."] },
    ],
    statuses: [
      { name: "Open / Partial", meaning: "Not (fully) paid yet." },
      { name: "Overdue", meaning: "Past its due date." },
      { name: "Paid", meaning: "Fully paid." },
    ],
    rules: [
      "VAT can't be negative and must be less than the bill amount, which includes it.",
      "The due date can't be before the invoice date.",
      "A bill with payments against it can't be deleted: delete its vendor payments first.",
      "Each accepted goods receipt is billed once.",
    ],
    related: [
      { route: "/purchase-service/goods-receipt-notes", label: "Goods Receipt Notes" },
      { route: "/vendorPayments", label: "Vendor Payments" },
      { route: "/accountsPayable", label: "Accounts Payable" },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "bill-reader",
    route: "/billReader",
    module: "Invoice",
    title: "Read a Vendor Bill",
    summary: "Upload a vendor's bill as a PDF or photo. Claude (Anthropic's AI) reads it in English or Arabic and fills in the bill; nothing is saved until you create it.",
    who: [
      { role: "Finance Manager / Executive", can: "Read bills and create them (needs the Invoice create right)." },
    ],
    tasks: [
      {
        title: "Read a bill",
        steps: [
          "Drop the PDF or photo on the page, or choose a file (PDF, JPG, PNG or WebP, up to 10 MB).",
          "Click Read the bill.",
          "Check What was read: the vendor (found by its tax number), the lines and the totals. Anything doubtful is marked.",
          "Click Create the bill. When a goods receipt matches, Bill goods receipt bills it from the receipt instead.",
        ],
      },
    ],
    rules: [
      "AI must be switched on for the company in Company Settings, and there is a monthly allowance of readings.",
      "The file is sent to Anthropic to be read and isn't kept in MyTrade.",
      "It warns when a bill with the same number from this vendor is already in the books.",
    ],
    related: [{ route: "/purchaseInvoices", label: "Purchase Invoices" }],
  },
  {
    id: "vendor-payments",
    route: "/vendorPayments",
    module: "Invoice",
    title: "Vendor Payments",
    summary: "Money paid to vendors: against one bill, across several bills, or ahead of the bills as an advance.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Pay a vendor",
        steps: [
          "Click Pay vendor and choose the Vendor.",
          "Enter the Amount paid, Payment date, Method, Paid from and Currency (and the Cheque date for a cheque).",
          "Under Bills, click Fill oldest first or enter what each bill gets (Pay now). Anything beyond the bills is kept as an advance.",
          "Click Record payment. To pay just one bill you can also click Pay on Accounts Payable.",
        ],
      },
      { title: "Use an advance", steps: ["Under Advances to vendors, click Use on a bill and choose the bill and amount."] },
      {
        title: "Approve a large payment",
        who: "Finance Manager",
        steps: ["A payment over the approval limit shows Awaiting approval. Someone with approval rights, other than the person who recorded it, clicks Approve payment; only then is the bill paid.", "Reject payment, with the reason, leaves it on the list as rejected."],
      },
    ],
    statuses: [
      { name: "Awaiting approval", meaning: "Over the limit; the bill isn't paid yet." },
      { name: "Rejected", meaning: "Not approved; nothing was paid." },
      { name: "Post-dated", meaning: "A cheque dated later: the bill is paid now and the cheque is owed until it clears." },
    ],
    rules: [
      "The approval limit is set on Posting Accounts (in the company's currency).",
      "A post-dated cheque pays bills only, not an advance.",
      "Take off this bill moves a payment off a bill: the bill is due again.",
      "An advance can be deleted only while none of it is used.",
    ],
    related: [
      { route: "/purchaseInvoices", label: "Purchase Invoices" },
      { route: "/accountsPayable", label: "Accounts Payable" },
      { route: "/cheques", label: "Cheques" },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "accounts-payable",
    route: "/accountsPayable",
    module: "Invoice",
    title: "Accounts Payable",
    summary: "What you owe vendors: open bills, what is overdue or due this week, the aging by days past due, and debit notes.",
    who: FINANCE_WHO,
    tasks: [
      { title: "Pay a bill", steps: ["Click Pay on the bill.", "Enter the Amount paid, Payment date, Method, Paid from and Reference (UTR, cheque no.), then Record payment."] },
      { title: "See what is late", steps: ["Aging by days past due groups each vendor's balance; Due in the next 7 days lists this week's bills."] },
    ],
    statuses: [
      { name: "Applied", meaning: "Debit note taken off the bill's balance." },
      { name: "Left off bill", meaning: "The bill was made without these goods." },
      { name: "Waiting for bill", meaning: "Applied when the goods receipt is billed." },
    ],
    rules: ["Payables are created from purchase invoices.", "Debit notes (goods returned to vendors, corrections on a bill) reduce what is owed, like payments."],
    related: [
      { route: "/purchaseInvoices", label: "Purchase Invoices" },
      { route: "/vendorPayments", label: "Vendor Payments" },
      { route: "/purchase-service/returns", label: "Purchase Returns" },
    ],
  },

  /* ================= Banking ================= */
  {
    id: "bank-cash",
    route: "/bankAccounts",
    module: "Invoice",
    title: "Bank & Cash",
    summary: "Your bank accounts and cash boxes. Receipts and payments choose one; each is kept in an asset account of the chart and reconciled against its bank statement.",
    who: [
      { role: "Finance Manager", can: "Add and change accounts (finance administrator right), and reconcile." },
      { role: "Finance Executive", can: "Reconcile: import statements, match and post lines." },
    ],
    tasks: [
      {
        title: "Add an account",
        who: "Finance Manager",
        steps: [
          "Click Add account.",
          "Enter the Name and Kind (bank or cash), the Bank, Account number, IBAN, SWIFT / BIC and Currency; choose the Ledger account.",
          "Enter the Opening date and Balance on the opening date; choose what it is the Default for. Save.",
        ],
      },
      {
        title: "Reconcile with the bank statement",
        steps: [
          "Click Reconcile with the bank statement on the account.",
          "Import statement: the CSV or Excel file from online banking (lines already imported are skipped).",
          "Click Auto-match, then Match the rest: tick the ledger lines a bank line clears (a deposit of several receipts can clear many).",
          "A bank line not in the books yet (charges, interest): Post it to the books.",
        ],
      },
    ],
    rules: [
      "The opening balance posts against opening balance equity on the opening date (an overdraft as a negative amount). Linking an account that already has postings? Leave the balance at 0.",
      "Closed (inactive) accounts can't take new receipts or payments.",
      "Until you add an account, receipts and payments post to the Cash or Bank posting account by their method.",
      "A journal entry matched to a statement line can't be changed until it is unmatched.",
    ],
    related: [
      { route: "/cheques", label: "Cheques" },
      { route: "/generalAccounts", label: "Chart of Accounts" },
    ],
    flows: ["month-end"],
  },
  {
    id: "cheques",
    route: "/cheques",
    module: "Invoice",
    title: "Cheques",
    summary: "Post-dated cheques: customers' cheques in hand and your cheques to vendors not yet cleared, until the bank pays them.",
    who: FINANCE_WHO,
    tasks: [
      { title: "Find a cheque", steps: ["Choose From customers or To vendors, and Show the ones you need."] },
      { title: "A customer's cheque", steps: ["Click Deposit when it goes to the bank (Paid into).", "Click Cleared when the bank pays it (from its date on)."] },
      { title: "It bounced", who: "Finance Manager", steps: ["Click Bounced; add the Bank charge (optional). The invoices it paid are open again."] },
      { title: "Your cheque", steps: ["Click Cleared when it leaves the bank. Cancel (Finance Manager) makes the bills due again."] },
    ],
    statuses: [
      { name: "In hand", meaning: "Received, not yet deposited." },
      { name: "Deposited", meaning: "Paid into the bank, waiting to clear." },
      { name: "Issued", meaning: "Your cheque, not yet cleared." },
      { name: "Cleared", meaning: "The bank paid it." },
      { name: "Bounced", meaning: "The customer's bank refused it." },
      { name: "Cancelled", meaning: "Your cheque was stopped." },
    ],
    rules: ["A cheque dated after its payment date is post-dated: record it on a receipt or vendor payment with its cheque date, and it shows here until it clears."],
    related: [
      { route: "/paymentReceipts", label: "Payment Receipts" },
      { route: "/vendorPayments", label: "Vendor Payments" },
    ],
  },
  {
    id: "cash-flow-forecast",
    route: "/cashFlowForecast",
    module: "Invoice",
    title: "Cash Flow Forecast",
    summary: "The money in your bank and cash accounts today, then week by week from what the books already expect: customer invoices, cheques, recurring invoices, vendor bills and payroll.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Look ahead",
        steps: [
          "Choose how many weeks to Look ahead and, optionally, the balance to Keep at least; click Work out again.",
          "Open a week to see each amount and where it comes from.",
        ],
      },
    ],
    rules: [
      "Customer invoices are moved by how late each customer usually pays.",
      "Invoices more than 90 days overdue are left out: chase them, and count them once a date is agreed.",
      "Not in it yet: VAT and social security payments, rent and other costs not entered as bills, purchase orders not billed, sales orders not invoiced, and loans.",
    ],
    related: [
      { route: "/accountsReceivable", label: "Accounts Receivable" },
      { route: "/accountsPayable", label: "Accounts Payable" },
    ],
  },
  {
    id: "letters-of-credit",
    route: "/lettersOfCredit",
    module: "Invoice",
    title: "Letters of Credit",
    summary: "LCs your bank opens for a purchase order: the margin is held from the bank account and released as the bank pays the vendor.",
    who: [
      { role: "Finance Manager", can: "Everything, including marking an LC issued, paying under it, amending and closing it." },
      { role: "Finance Executive", can: "Prepare draft LCs and record the documents." },
    ],
    tasks: [
      {
        title: "Prepare the LC",
        steps: [
          "Click New letter of credit.",
          "Enter the LC number (from the bank), Purchase order, Issuing bank (your account), Payable At sight or Usance, Advising bank, Tolerance ± %, Margin % and Opening charges.",
          "Enter the Issue date, Expiry date, Latest shipment date, Incoterm, and the Documents the vendor must present. Save draft.",
        ],
      },
      { title: "The bank issued it", who: "Finance Manager", steps: ["Open the draft and click Issued by the bank: the margin and charges leave the bank account."] },
      { title: "Documents arrive", steps: ["Enter when each document was Received on and any Discrepancy, then Save documents."] },
      {
        title: "The bank paid the vendor",
        who: "Finance Manager",
        steps: ["Click Record a payment: the bills paid, the bank's reference and charges. Make the bill from the goods receipt first."],
      },
      { title: "Change or finish it", who: "Finance Manager", steps: ["Amend for a new amount or dates (the margin follows the amount).", "Close, with the reason: the rest of the margin comes back into the bank."] },
    ],
    statuses: [
      { name: "Draft", meaning: "Prepared; can be edited or deleted." },
      { name: "Open", meaning: "Issued by the bank; payments can be made under it." },
      { name: "Closed", meaning: "Finished; nothing more can be paid." },
      { name: "Cancelled", meaning: "Not used." },
    ],
    rules: ["A discrepant document stops payments until the discrepancy is cleared or waived."],
    related: [
      { route: "/purchase-service/orders", label: "Purchase Orders" },
      { route: "/purchaseInvoices", label: "Purchase Invoices" },
    ],
  },

  /* ================= Accounting ================= */
  {
    id: "journal-entries",
    route: "/journalEntries",
    module: "Invoice",
    title: "Journal Entries",
    summary: "Every posting in the books. Invoices, receipts, bills, payments and stock post their own entries; add manual entries for anything else.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Add a manual entry",
        steps: [
          "Click New journal entry.",
          "Enter the Date, Source and Description.",
          "Add the lines: the Account, a Debit or a Credit, a Narration and a Cost centre where useful (Add line for more).",
          "Save once debits equal credits.",
        ],
      },
    ],
    rules: [
      "An entry needs at least one debit and one credit line, and its debits and credits must be equal.",
      "Entries posted automatically from a document can't be edited or deleted: correct or cancel the document instead.",
      "An entry matched in a bank reconciliation must be unmatched before it changes.",
      "Nothing can be posted, changed or deleted on or before the lock date.",
    ],
    related: [
      { route: "/generalLedger", label: "General Ledger" },
      { route: "/generalAccounts", label: "Chart of Accounts" },
    ],
  },
  {
    id: "general-ledger",
    route: "/generalLedger",
    module: "Invoice",
    title: "General Ledger",
    summary: "One account's postings in a period, with the opening balance, every debit and credit and the closing balance.",
    who: FINANCE_WHO,
    tasks: [
      { title: "Read an account", steps: ["Choose the Account and the From / To dates.", "Each posting shows its entry and running balance. Clicking an account on Chart of Accounts opens it here."] },
    ],
    rules: ["Postings come from journal entries; the totals check that debits equal credits."],
    related: [
      { route: "/journalEntries", label: "Journal Entries" },
      { route: "/financialStatements", label: "Financial Statements" },
    ],
  },
  {
    id: "financial-statements",
    route: "/financialStatements",
    module: "Invoice",
    title: "Financial Statements",
    summary: "Profit & loss, balance sheet and trial balance from the ledger, for any period and cost centre.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Read the statements",
        steps: [
          "Choose Profit & loss, Balance sheet or Trial balance.",
          "Choose the Range (this month, last month, this quarter, financial year to date, last financial year or custom).",
          "For a part of the business, choose the Cost centre.",
          "Click PDF to print it (needs the export right).",
        ],
      },
    ],
    rules: [
      "Profit to date is income less expenses since the last year-end close, which moves them to retained earnings.",
      "Accounts without a statement type are listed separately: give them a type on Chart of Accounts.",
    ],
    related: [
      { route: "/generalLedger", label: "General Ledger" },
      { route: "/costCentres", label: "Cost Centres" },
      { route: "/budgets", label: "Budgets" },
    ],
    flows: ["month-end"],
  },
  {
    id: "fixed-assets",
    route: "/fixedAssets",
    module: "Invoice",
    title: "Fixed Assets",
    summary: "The asset register: what each asset cost, its depreciation month by month and its book value, until it is sold or scrapped.",
    who: [
      { role: "Finance Manager", can: "Everything, including running depreciation and disposing of assets (finance administrator right)." },
      { role: "Finance Executive", can: "Add and edit assets." },
    ],
    tasks: [
      {
        title: "Add an asset",
        steps: [
          "Click New asset.",
          "Enter the Name, Category (e.g. Vehicles) and Cost centre; say How it was acquired: on a bill entered here (Bill no.) or owned before go-live (with its Depreciation before go-live).",
          "Enter the Acquisition date, Cost, Salvage value, Depreciate from, Useful life (months from then) and the Method (Straight line, or Reducing balance with its Yearly rate). Save.",
        ],
      },
      { title: "Depreciate", who: "Finance Manager", steps: ["Under Run depreciation, choose Up to (the month) and click Post. Run it at each month's end."] },
      { title: "Sell or scrap it", who: "Finance Manager", steps: ["Open the asset and click Dispose: the Date, the Proceeds (empty if scrapped) and Deposit to."] },
    ],
    statuses: [
      { name: "Active", meaning: "In use and depreciating." },
      { name: "Disposed", meaning: "Sold or scrapped." },
    ],
    rules: [
      "Posted depreciation months can't be undone.",
      "Once depreciation is posted, only the name, category, cost centre and notes can change.",
      "The month of disposal isn't depreciated; months before it must be posted first. VAT on a sale is not included: invoice it separately if it applies.",
    ],
    related: [
      { route: "/purchaseInvoices", label: "Purchase Invoices" },
      { route: "/journalEntries", label: "Journal Entries" },
    ],
    flows: ["month-end"],
  },
  {
    id: "budgets",
    route: "/budgets",
    module: "Invoice",
    title: "Budgets",
    summary: "Yearly budgets per account, for the whole company or a cost centre, compared with what actually happened.",
    who: SETUP_WHO("Add and change budgets"),
    tasks: [
      {
        title: "Make a budget",
        who: "Finance Manager",
        steps: [
          "Click New budget: the Name, First month and Cost centre (or the whole company).",
          "Click Add account for each income or expense account and enter the amount for the Year (spread evenly), or month by month. Save.",
        ],
      },
      { title: "Compare with the actual", steps: ["Open Budget against actual, choose From and To: Budget, Actual and Better / worse per account, and the net profit."] },
    ],
    related: [
      { route: "/financialStatements", label: "Financial Statements" },
      { route: "/costCentres", label: "Cost Centres" },
    ],
  },
  {
    id: "expense-revenue",
    route: "/expenseRevenue",
    module: "Invoice",
    title: "Expense / Revenue",
    summary: "Day-to-day expenses and income that don't come with a bill or an invoice, such as petty cash, bank charges or scrap sales. Each item posts to the ledger.",
    who: FINANCE_WHO,
    tasks: [
      {
        title: "Record one",
        steps: [
          "Click Record expense / income.",
          "Choose the Type and Category; enter the Description, Amount, Date and Payment method; choose Paid from (or Received into) and, optionally, the Ledger account.",
          "Save: it posts to the ledger.",
        ],
      },
      {
        title: "Post an older item",
        steps: ["Items recorded before automatic postings show Not posted: click Post to the ledger, only if it isn't already in the books (for example through its bank statement line)."],
      },
    ],
    rules: ["Only expenses and income post. Record transfers and adjustments as a journal entry."],
    related: [{ route: "/journalEntries", label: "Journal Entries" }],
  },
  {
    id: "tax-records",
    route: "/taxRecords",
    module: "Invoice",
    title: "Tax Records",
    summary: "A record of tax collected and paid, with the taxable amount and where it came from.",
    who: FINANCE_WHO,
    tasks: [
      { title: "Record tax", steps: ["Click Record tax.", "Choose the Type and Tax type; enter the Taxable amount, Date, Source and, optionally, the Source document id. Save."] },
      { title: "See a period", steps: ["Choose From and To."] },
    ],
    rules: ["Tax records can't be edited or deleted afterwards."],
    related: [
      { route: "/taxTypes", label: "Tax Types" },
      { route: "/vatReturn", label: "VAT Return" },
    ],
  },

  /* ================= Set-up ================= */
  {
    id: "chart-of-accounts",
    route: "/generalAccounts",
    module: "Invoice",
    title: "Chart of Accounts",
    summary: "The company's accounts: assets, liabilities, equity, income and expenses. Every posting goes to one of them.",
    who: FINANCE_WHO,
    tasks: [
      { title: "Start the chart", steps: ["On an empty chart, click Start with a standard chart to add the usual accounts; change or add to them after."] },
      {
        title: "Add an account",
        steps: [
          "Click Add account.",
          "Enter the Code (unique within your company), Name, Type and Currency, and the Opening balance and Description if needed.",
          "Turn off Accepts postings for heading accounts that only group others. Save.",
        ],
      },
      { title: "See its postings", steps: ["Click the account: its General Ledger opens."] },
    ],
    rules: [
      "Inactive accounts are hidden from pickers.",
      "An account with postings, or used by expense / income items, can't be deleted: make it inactive instead.",
    ],
    related: [
      { route: "/postingAccounts", label: "Posting Accounts" },
      { route: "/generalLedger", label: "General Ledger" },
    ],
  },
  {
    id: "posting-accounts",
    route: "/postingAccounts",
    module: "Invoice",
    title: "Posting Accounts",
    summary: "How the books run by themselves: which account each automatic posting uses, the lock date, the payment approval limit, month-end exchange revaluation and year-end close.",
    who: SETUP_WHO("Change any of it"),
    tasks: [
      {
        title: "Lock a closed month",
        who: "Finance Manager",
        steps: ["Under Lock the books, choose Lock up to and click Save lock date. Nothing dated on or before it can be posted, changed, cancelled or deleted.", "To open it again, move the date back (with the reason) or click Open all periods."],
      },
      { title: "Set the payment approval limit", who: "Finance Manager", steps: ["Enter the amount (in the company's currency) and click Save limit; leave it empty for no limit."] },
      {
        title: "Revalue foreign currency at month-end",
        who: "Finance Manager",
        steps: ["Under Month-end exchange revaluation, choose Revalue at (the date) and click Post revaluation. Undo reverses it."],
      },
      {
        title: "Close the year",
        who: "Finance Manager",
        steps: ["Under Year-end close, choose the Last day of the year and click Close the year.", "Reopen, with the reason, reverses the closing entry and moves the lock date back."],
      },
      {
        title: "Change where postings go",
        who: "Finance Manager",
        steps: ["Under Automatic postings, choose another account of the same type for any kind of amount.", "Post earlier documents posts invoices, receipts, notes, bills and payments recorded before automatic postings (those already posted are skipped)."],
      },
    ],
    rules: [
      "Lock a month once its VAT return is filed or its accounts are closed; corrections then go in an open period.",
      "Revaluation restates open foreign-currency invoices and bills at the rate on the date and reverses the next day. Bank balances, customer credits and vendor advances are not revalued.",
      "Closing a year moves its income and expenses to retained earnings in one entry dated the year end, and locks the books up to that date.",
    ],
    related: [
      { route: "/generalAccounts", label: "Chart of Accounts" },
      { route: "/exchangeRates", label: "Exchange Rates" },
      { route: "/vendorPayments", label: "Vendor Payments" },
    ],
    flows: ["month-end"],
  },
  {
    id: "exchange-rates",
    route: "/exchangeRates",
    module: "Invoice",
    title: "Exchange Rates",
    summary: "What one unit of each foreign currency is worth in the company's currency, from a date. Documents in that currency are booked at the rate of their date.",
    who: [
      { role: "Finance Manager / Executive", can: "Add rates; removing one needs the delete right (Finance Manager)." },
    ],
    tasks: [
      { title: "Add a rate", steps: ["Enter the Currency (e.g. USD), the rate, From (the date) and the Source (optional), then click Save rate."] },
      { title: "See the exchange result", steps: ["Exchange gains and losses shows what settlements in foreign currency made or lost."] },
    ],
    rules: ["Use a 3-letter currency code such as USD.", "Removing a rate doesn't change documents that used it: they keep their rate."],
    related: [{ route: "/postingAccounts", label: "Posting Accounts", why: "Month-end revaluation" }],
  },
  {
    id: "cost-centres",
    route: "/costCentres",
    module: "Invoice",
    title: "Cost Centres",
    summary: "Parts of the business you want a profit and loss for, such as a branch, a project or a department.",
    who: SETUP_WHO("Add and change cost centres"),
    tasks: [
      { title: "Add one", who: "Finance Manager", steps: ["Click New cost centre: Code, Name and Description; tick Active. Save."] },
      { title: "Use it", steps: ["Choose it on journal lines and bills, then read the profit and loss per cost centre in Financial Statements."] },
    ],
    rules: ["Only income and expense lines carry a cost centre.", "Inactive cost centres can't be chosen on new postings."],
    related: [
      { route: "/financialStatements", label: "Financial Statements" },
      { route: "/budgets", label: "Budgets" },
    ],
  },
  {
    id: "zatca",
    route: "/zatca",
    module: "Invoice",
    title: "ZATCA e-invoicing",
    summary: "For VAT-registered companies in Saudi Arabia: every issued invoice and credit note becomes a ZATCA e-invoice. With a certificate it is also signed and gets the ZATCA QR code, which the invoice PDF prints.",
    who: SETUP_WHO("Manage the certificate and onboarding"),
    tasks: [
      { title: "Try it locally", who: "Finance Manager", steps: ["Before onboarding, Create a local test certificate signs invoices without sending them to ZATCA (shown until a production certificate is in place)."] },
      {
        title: "Onboard with ZATCA",
        who: "Finance Manager",
        steps: [
          "Get an OTP for a new e-invoicing unit in the Fatoora portal.",
          "Enter the OTP from the Fatoora portal, the E-invoicing unit name, the Invoices issued, Branch (organisation unit), Branch location and Industry.",
          "Click Start onboarding: the compliance certificate, ZATCA's sample checks and the production certificate follow by themselves.",
        ],
      },
    ],
    rules: ["The zatca.secret setting must be set on the invoice service before certificates can be stored.", "Each invoice shows its ZATCA status; Send now retries one ZATCA couldn't be reached for."],
    related: [
      { route: "/invoices", label: "Invoices" },
      { route: "/company-settings", label: "Company Settings" },
    ],
  },
  {
    id: "uae-einvoicing",
    route: "/uae-einvoicing",
    module: "Invoice",
    title: "UAE e-invoicing",
    summary: "For VAT-registered companies in the UAE: invoices and credit notes to VAT-registered businesses and buyers abroad become PINT AE e-invoices when issued. The service provider delivers them and reports them to the FTA; suppliers' e-invoices arrive here.",
    who: SETUP_WHO("Connect the service provider"),
    tasks: [
      { title: "Connect", who: "Finance Manager", steps: ["Choose the Service provider and click Connect. The Peppol participant ID needs the company's TRN."] },
      {
        title: "Bill a supplier's e-invoice",
        steps: [
          "Under Received from suppliers, click Check inbox (it is also checked every 10 minutes).",
          "Open the e-invoice, choose the vendor and click Create bill: it books the payable and the input VAT.",
          "Set aside one you won't bill. Record a supplier's credit note as a debit note against its bill.",
        ],
      },
    ],
    rules: ["Each invoice is also checked for the buyer's TRN and address, HS codes and the 5% rate; the invoice screen lists what to fix."],
    related: [
      { route: "/invoices", label: "Invoices" },
      { route: "/purchaseInvoices", label: "Purchase Invoices" },
    ],
  },
];
