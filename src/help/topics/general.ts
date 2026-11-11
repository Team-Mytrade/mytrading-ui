import type { HelpRole, HelpTopic } from "../types";

// Home (Command Center, Ask MyTrade), Reports and Settings. Rights: the reports follow their module's access; company
// settings need USERS:ADMIN (the Tenant Administrator, "Company Admin" in the demo); Users needs the Users rights (adding
// CREATE, changing roles and resending invites UPDATE); Tenants & Modules and Plans are the platform Super Admin's.
const TENANT_ADMIN: HelpRole[] = [{ role: "Tenant Administrator", can: "Change these settings (needs the Users admin right). Others can't open the page." }];

const SUPER_ADMIN: HelpRole[] = [{ role: "Super Admin", can: "Run the platform: every company, its modules and plan. Company users never see these pages." }];

const moduleReader = (module: string): HelpRole[] => [{ role: `Anyone with ${module} access`, can: "Read the report." }];

export const HOME_TOPICS: HelpTopic[] = [
  {
    id: "command-center",
    route: "/",
    module: "Home",
    title: "Command Center",
    summary: "Your start page: the work waiting for you across the modules, and each module's dashboard.",
    who: [{ role: "Everyone", can: "Their own queues and the dashboards of the modules they can open." }],
    tasks: [
      {
        title: "See what waits for you",
        steps: [
          "Needs your attention lists your queues: approvals, orders to confirm, dispatches to invoice, overdue invoices and bills, products to reorder, expiring batches and more. Click one to open it.",
          "Check again refreshes it; it shows All clear when nothing waits.",
        ],
      },
      { title: "Open a dashboard", steps: ["Pick a module (Reports, Common, CRM, Sales, Purchase, Inventory, Delivery, Invoice, HRMS or Attendance) to load its dashboard."] },
      {
        title: "Finish setting up (administrators)",
        steps: ["Until the company is set up, a Getting started banner shows the next step: click Continue setup, or Hide from the Command Center."],
      },
    ],
    rules: ["Each queue shows only what your rights let you act on."],
    related: [
      { route: "/ask", label: "Ask MyTrade" },
      { route: "/getting-started", label: "Getting started" },
    ],
  },
  {
    id: "ask-mytrade",
    route: "/ask",
    module: "Home",
    title: "Ask MyTrade",
    summary: "Ask about sales, money owed, profit, cash or stock in your own words. Claude (Anthropic's AI) answers from the reports you can open, with a link to each; nothing is changed.",
    who: [{ role: "Everyone", can: "Ask about the reports they can open; a report they can't open isn't used." }],
    tasks: [
      {
        title: "Ask a question",
        steps: [
          "Type your question (or click one under Try asking) and click Ask.",
          "Read the answer and open the reports it links to; Ask again for a follow-up.",
        ],
      },
    ],
    rules: [
      "AI must be switched on for the company in Company Settings; each question counts against the monthly AI uses.",
      "The figures a question needs are sent with it to Anthropic.",
      "Answers can be wrong: check the figures in the report.",
    ],
    related: [{ route: "/company-settings", label: "Company Settings" }],
  },
];

const financeReader: HelpRole[] = [
  { role: "Anyone with Invoice access", can: "Read the report. Excel, PDF and Print need the Invoice export right." },
];

const purchaseReader: HelpRole[] = [
  { role: "Anyone with Purchase or Invoice access", can: "Read the report. Excel, PDF and Print need the export right in Purchase or Invoice." },
];

const salesReader: HelpRole[] = [
  { role: "Anyone with Sales or Invoice access", can: "Read the report. Excel, PDF and Print need the export right in Sales or Invoice." },
];

export const REPORT_TOPICS: HelpTopic[] = [
  {
    id: "report-center",
    route: "/reports",
    aliases: ["/reports/sales", "/reports/purchase", "/reports/inventory", "/reports/finance", "/reports/hr"],
    module: "Reports",
    title: "Report Center",
    summary: "The business reports, by module: Sales, Purchase, Inventory, Finance and HR & Payroll. All reports lists every one; each module's entry lists just its own. You see only the reports your rights let you open.",
    who: [{ role: "Everyone", can: "The reports of the modules they can open." }],
    tasks: [
      {
        title: "Open a report",
        steps: [
          "In the menu, open Reports and pick a module (Sales, Purchase, Inventory, Finance or HR & Payroll) to see its reports, or All reports to see every one.",
          "Type in Search reports to find one by name. On All reports, Only these opens a module's own page.",
          "Click a report to open it. Reports marked Excel · PDF · Print share the same filters and can be exported or printed with the company header.",
        ],
      },
    ],
    rules: [
      "A module's report needs that module's access; the sales reports open with Sales or Invoice access.",
      "A module shows in the menu only when you can open at least one of its reports.",
    ],
    related: [
      { route: "/reports/sales-register", label: "Sales Register" },
      { route: "/reports/sales-analysis", label: "Sales Analysis" },
      { route: "/reports/open-orders", label: "Open Orders" },
      { route: "/reports/dispatched-not-invoiced", label: "Dispatched Not Invoiced" },
      { route: "/reports/quotation-conversion", label: "Quotation Conversion" },
      { route: "/reports/returns-refunds", label: "Returns & Refunds" },
      { route: "/reports/gross-margin", label: "Gross Margin" },
      { route: "/reports/purchase-register", label: "Purchase Register" },
      { route: "/reports/purchase-analysis", label: "Purchase Analysis" },
      { route: "/reports/open-purchase-orders", label: "Open Purchase Orders" },
      { route: "/reports/received-not-billed", label: "Goods Received Not Billed" },
      { route: "/reports/vendor-performance", label: "Vendor Performance" },
      { route: "/reports/day-book", label: "Day Book" },
      { route: "/reports/cash-bank-book", label: "Cash & Bank Book" },
      { route: "/reports/receipts-payments", label: "Receipts & Payments" },
      { route: "/reports/customer-ledger", label: "Customer Ledger" },
      { route: "/reports/vendor-ledger", label: "Vendor Ledger" },
      { route: "/reports/expenses", label: "Expenses by Account" },
      { route: "/reports/headcount", label: "Headcount" },
      { route: "/reports/payroll-register", label: "Payroll Register" },
      { route: "/reports/leave-balances", label: "Leave Balances" },
      { route: "/reports/stock-aging", label: "Stock Aging" },
      { route: "/reports/abc-analysis", label: "ABC Analysis" },
    ],
  },
  {
    id: "sales-register",
    route: "/reports/sales-register",
    module: "Reports",
    title: "Sales Register",
    summary: "Every issued invoice and credit note in a period, one line each, with net, tax and total in the company currency.",
    who: salesReader,
    tasks: [
      {
        title: "Read the register",
        steps: [
          "Choose the Period (this month, last month, this or last quarter, this or last year) or set From and To.",
          "Narrow it to one Customer or Sales person if you need to.",
          "The cards show Invoiced, Credit notes, Net sales and Total with tax; the table lists each document, with credit notes as minus amounts in red.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print. The file has the company header, the period, the filters and a total line."] },
    ],
    fields: [
      { name: "Net", meaning: "Before tax, in the company currency; a document in another currency is converted at its own exchange rate." },
      { name: "Document currency", meaning: "The document's total in the currency it was issued in." },
    ],
    rules: [
      "Invoices count on their invoice date; credit notes on their own date, even when the invoice is from an earlier period.",
      "Drafts, cancelled invoices and opening invoices (from Data Import) are left out.",
    ],
    related: [
      { route: "/reports/sales-analysis", label: "Sales Analysis" },
      { route: "/invoices", label: "Invoices" },
    ],
  },
  {
    id: "sales-analysis",
    route: "/reports/sales-analysis",
    module: "Reports",
    title: "Sales Analysis",
    summary: "Net sales for a period grouped by customer, product, category, sales person or month, after credit notes, with each one's share.",
    who: salesReader,
    tasks: [
      {
        title: "Analyse sales",
        steps: [
          "Choose the Period and, if you need to, a Customer or Sales person.",
          "Pick By customer, By product, By category, By sales person or By month. The chart shows the top 10 (every month for By month).",
          "Click a row to look closer: a customer, sales person or month opens its documents in the Sales Register; a product shows who bought it; a category shows its products. Remove a product or category filter with its ×.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print; the grouping and the filters are printed in the header."] },
    ],
    fields: [
      { name: "Net sales", meaning: "Invoiced less credit notes, before tax." },
      { name: "Credit notes", meaning: "Issued in the period, split over the invoice's lines by their value, so each product and category gets its part." },
      { name: "Share", meaning: "The row's part of the period's net sales." },
      { name: "Quantity", meaning: "By product only: the quantity invoiced." },
    ],
    rules: [
      "Invoices count on their invoice date, credit notes on theirs; drafts, cancelled and opening invoices are left out.",
      "A period can be at most three years.",
      "If the product catalogue can't be read, By category shows everything under No category, with a warning.",
    ],
    related: [
      { route: "/reports/sales-register", label: "Sales Register" },
      { route: "/salesCommission", label: "Sales Commission" },
    ],
  },
  {
    id: "open-orders",
    route: "/reports/open-orders",
    module: "Reports",
    title: "Open Orders",
    summary: "Confirmed sales orders with lines still to deliver: what is waiting, its value before tax, how late it is, and the backlog by product.",
    who: salesReader,
    tasks: [
      {
        title: "See what is still to deliver",
        steps: [
          "The report opens on All dates: every open order now. Choose an Order date period to see only the orders placed then, and a Customer or Sales person if you need to.",
          "The cards show Open orders (and how many are on credit hold), Still to deliver, Late (orders past their expected delivery date) and the Ordered value of those orders.",
          "Still to deliver by product adds up each product's pending quantity and value across the orders.",
          "The table lists each order, the most days late first, with what each line still has to deliver (for example Steel bolts 2 of 4).",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print. The file lists each order with its days late, ordered value and pending value, and a total line."] },
    ],
    fields: [
      { name: "Pending value", meaning: "The quantity still to deliver at the order line's price after discounts, before tax, in the company currency. Under it, the amount in the order's own currency when that is another one." },
      { name: "Expected delivery", meaning: "The order's expected delivery date (it comes from its quotation); days late count from it." },
    ],
    rules: [
      "Drafts, cancelled orders and orders closed short are left out. An order shows while any line has quantity pending; quantity on a draft dispatch is still pending.",
      "An order in another currency uses finance's exchange rate on or before its order date; without a rate its value is left out of the totals, with a warning naming the currency.",
    ],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/reports/dispatched-not-invoiced", label: "Dispatched Not Invoiced" },
    ],
  },
  {
    id: "dispatched-not-invoiced",
    route: "/reports/dispatched-not-invoiced",
    module: "Reports",
    title: "Dispatched Not Invoiced",
    summary: "Confirmed dispatches (goods or services that went out) that no issued invoice bills yet: no invoice made, only a draft, or the invoice was cancelled.",
    who: salesReader,
    tasks: [
      {
        title: "Find what is still to invoice",
        steps: [
          "The report opens on All dates. Choose a Dispatch date period, a Customer or a Sales person to narrow it.",
          "The cards show what is Waiting to be invoiced (with tax), the value Before tax, how many dispatches waited Over a week, and how many have an Invoice started (a draft or a cancelled invoice).",
          "The table lists each dispatch, the oldest first, with its Stage: Not invoiced, Draft invoice or Invoice cancelled.",
        ],
      },
      {
        title: "Invoice a dispatch",
        who: "Finance Manager",
        steps: [
          "Click Invoice it: Invoices opens with Generate invoice and that dispatch chosen. Check the date, click Create draft, then issue the invoice.",
          "For a draft or a cancelled invoice, Open invoice shows it on Invoices.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "Waiting", meaning: "Days since the dispatch date; more than a week shows in red." },
      { name: "Net", meaning: "The quantities sent at the order's prices after discounts, before tax, in the company currency at the dispatch date's rate. The invoice itself is worked out when it is made." },
    ],
    rules: [
      "Invoice it needs the Invoice create right.",
      "A dispatch has one invoice. Once that invoice is cancelled the dispatch can't be invoiced again, so it stays here as Invoice cancelled for finance to follow up.",
      "Without an exchange rate for a dispatch's currency, its value is left out of the totals, with a warning.",
    ],
    related: [
      { route: "/invoices", label: "Invoices" },
      { route: "/reports/open-orders", label: "Open Orders" },
    ],
  },
  {
    id: "quotation-conversion",
    route: "/reports/quotation-conversion",
    module: "Reports",
    title: "Quotation Conversion",
    summary: "The quotations of a period and what each came to: how many and how much became orders, by sales person, customer or month.",
    who: salesReader,
    tasks: [
      {
        title: "Read the conversion",
        steps: [
          "Choose the Period (by quotation date) and, if you need to, a Customer or Sales person.",
          "Pick By sales person, By customer or By month. The cards show the Conversion rate (and by value), the Value quoted, what Became orders and how many were Lost (refused or run out).",
          "Each row shows Sent, Value quoted, Became orders, Conversion, By value, Accepted, Open, Refused, Ran out and the average Days to order.",
          "Click a row to list only its quotations below; remove that with its ×. Click a quotation number to open it.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print; the grouping and the filters are printed in the header."] },
    ],
    fields: [
      { name: "Conversion", meaning: "The quotations that became orders, out of those sent. By value: the same by their value before tax." },
      { name: "Outcome", meaning: "Became an order, Accepted, no order yet, Waiting for the customer, Refused, Ran out, or Not sent yet (a draft)." },
      { name: "Days to order", meaning: "From the quotation date to its order's date, on average." },
    ],
    rules: [
      "Drafts are not counted in the rates. A sent quotation past its valid-until date counts as run out, even if nobody marked it expired.",
      "Values are before tax, in the company currency at each quotation's date.",
    ],
    related: [
      { route: "/quotations", label: "Quotations" },
      { route: "/reports/sales-analysis", label: "Sales Analysis" },
    ],
  },
  {
    id: "returns-refunds",
    route: "/reports/returns-refunds",
    module: "Reports",
    title: "Returns & Refunds",
    summary: "Goods returned in a period, from sales orders and at the counter: why they came back, their value, and what was refunded or is still to refund.",
    who: salesReader,
    tasks: [
      {
        title: "Read the returns",
        steps: [
          "Choose the Period and, if you need to, a Customer or Sales person (counter returns have no sales person, so they leave the list when you pick one).",
          "The cards show the Returns (with exchanges and rejected ones), the Value returned, what was Refunded and what is Still to refund.",
          "Returns by reason shows the value per reason. The table lists each return with its order or sale, reason, status, value and refund.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "Value", meaning: "What the return refunds, tax included, in the company currency: the amount entered on its lines, else the value of the goods returned." },
      { name: "Refund", meaning: "Its refund's status, amount and date, and the credit notes finance made; Exchanged for a return settled by sending the items again." },
      { name: "Still to refund", meaning: "Money-back returns (not exchanges, not rejected) with no processed refund yet." },
    ],
    rules: [
      "Sales order returns count on their request date, counter returns on the day they were made.",
      "Rejected returns are listed (struck through) but not counted in the totals.",
    ],
    related: [
      { route: "/return-requests", label: "Return Requests" },
      { route: "/sales-pos", label: "Point of Sale" },
    ],
  },
  {
    id: "gross-margin",
    route: "/reports/gross-margin",
    module: "Reports",
    title: "Gross Margin",
    summary: "Net sales less what the goods cost when they left stock, for a period, by product, customer, category, sales person or month, with the margin in money and as a percentage.",
    who: [{ role: "Anyone with Invoice access", can: "Read the report (it shows what goods cost, so Sales access alone doesn't open it). Excel, PDF and Print need the Invoice export right." }],
    tasks: [
      {
        title: "Read the margin",
        steps: [
          "Choose the Period and, if you need to, a Customer or Sales person.",
          "Pick By product, By customer, By category, By sales person or By month. The cards show Net sales, Cost of goods, Gross margin (with Gross margin %) and the sales Without a cost.",
          "Click a row to look closer: a product shows who bought it, a category its products, a customer what they bought, a sales person their customers. Remove a filter with its ×.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print; the grouping and the filters are printed in the header."] },
    ],
    fields: [
      { name: "Net sales", meaning: "Invoiced less credit notes, before tax, in the company currency, counted as in Sales Analysis." },
      { name: "Cost of goods", meaning: "What each invoice line's goods cost when its dispatch took them out of stock (the average cost then), less the cost given back by returns." },
      { name: "Gross margin", meaning: "Net sales less Cost of goods, worked out only on sales whose cost is known. Gross margin %: the margin out of those sales." },
      { name: "Without a cost", meaning: "Sales whose goods have no known cost: stock held from before costing, or goods sold without a stock issue. They are kept out of the margin so it isn't overstated." },
      { name: "Share of margin", meaning: "The row's part of the period's gross margin." },
    ],
    rules: [
      "Services cost nothing from stock, so their margin is their whole value.",
      "A credit note for returned goods gives back the cost in the same share as the value it credits; a price, discount or correction credit note lowers sales only.",
      "Landed costs added after goods were sold are in the ledger's cost of goods sold but not here.",
      "If stock costs can't be read, goods show as Without a cost, with a warning. A period can be at most three years.",
    ],
    related: [
      { route: "/reports/sales-analysis", label: "Sales Analysis" },
      { route: "/inventory-report", label: "Inventory Report" },
    ],
  },
  {
    id: "purchase-register",
    route: "/reports/purchase-register",
    module: "Reports",
    title: "Purchase Register",
    summary: "Every vendor bill and debit note in a period, one line each, with net, tax and total in the company currency.",
    who: purchaseReader,
    tasks: [
      {
        title: "Read the register",
        steps: [
          "Choose the Period or set From and To, and a Vendor if you need to.",
          "The cards show Billed, Debit notes, Net purchases and Total with tax; the table lists each document, with debit notes as minus amounts in red.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print. The file has the company header, the period, the vendor and a total line."] },
    ],
    fields: [
      { name: "Net", meaning: "Before tax, in the company currency at the bill's exchange rate (a debit note at its bill's)." },
      { name: "Order / receipt", meaning: "The purchase order and goods receipt a bill was made from, when it was." },
    ],
    rules: [
      "Bills count on their bill date; cancelled and opening bills (from Data Import) are left out.",
      "A debit note counts on its own date when it was applied to a bill. A note for goods sent back before the bill was made is already left out of that bill, so it isn't counted again.",
    ],
    related: [
      { route: "/reports/purchase-analysis", label: "Purchase Analysis" },
      { route: "/purchaseInvoices", label: "Purchase Invoices" },
    ],
  },
  {
    id: "purchase-analysis",
    route: "/reports/purchase-analysis",
    module: "Reports",
    title: "Purchase Analysis",
    summary: "What was bought in a period, by vendor, product or month: goods accepted on goods receipts, less goods sent back for a debit note.",
    who: purchaseReader,
    tasks: [
      {
        title: "Analyse purchases",
        steps: [
          "Choose the Period and, if you need to, a Vendor.",
          "Pick By vendor, By product or By month. The chart shows the top 10 (every month for By month).",
          "Click a row to look closer: a vendor shows what was bought from them, a product who it came from, a month opens its bills in the Purchase Register. Remove a product filter with its ×.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print; the grouping and the filters are printed in the header."] },
    ],
    fields: [
      { name: "Received", meaning: "Accepted quantity at the purchase order line's price after its discount, before tax, on the receipt date, in the company currency." },
      { name: "Sent back", meaning: "Goods returned to the vendor for a debit note, on the return date. Goods sent back for a replacement don't lower purchases." },
      { name: "Quantity", meaning: "By product only: accepted less sent back." },
    ],
    rules: [
      "Only accepted goods receipts count; drafts and cancelled receipts are left out.",
      "This is what came in, so it can differ from the Purchase Register while receipts wait for their bills.",
      "An order in another currency uses finance's exchange rate on or before the receipt date; without one its value is left out of the totals, with a warning.",
    ],
    related: [
      { route: "/reports/purchase-register", label: "Purchase Register" },
      { route: "/reports/vendor-performance", label: "Vendor Performance" },
    ],
  },
  {
    id: "open-purchase-orders",
    route: "/reports/open-purchase-orders",
    module: "Reports",
    title: "Open Purchase Orders",
    summary: "Approved, sent and partly received purchase orders with goods still to receive: their value before tax, how late they are, and what is waiting by product.",
    who: purchaseReader,
    tasks: [
      {
        title: "See what is still to come",
        steps: [
          "The report opens on All dates: every open order now. Choose an Order date period or a Vendor to narrow it.",
          "The cards show Open orders (and units to receive), Still to receive, how many are Late and the Ordered value of those orders.",
          "The table lists each order, the most days late first, with what each line still has to receive (for example Hex nuts 10 of 20).",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "Still to receive", meaning: "Ordered less accepted on goods receipts, at the order line's price after discount, before tax, in the company currency." },
      { name: "Expected delivery", meaning: "The order's expected delivery date; days late count from it." },
    ],
    rules: [
      "Drafts, cancelled orders and orders closed short are left out.",
      "Rejected goods stay on the order as still to receive.",
    ],
    related: [
      { route: "/purchase-service/orders", label: "Purchase Orders" },
      { route: "/reports/received-not-billed", label: "Goods Received Not Billed" },
    ],
  },
  {
    id: "received-not-billed",
    route: "/reports/received-not-billed",
    module: "Reports",
    title: "Goods Received Not Billed",
    summary: "Accepted goods receipts that no vendor bill covers yet, oldest first: what the vendors will still bill you for.",
    who: purchaseReader,
    tasks: [
      {
        title: "Find receipts waiting for a bill",
        steps: [
          "The report opens on All dates. Choose a Receipt date period or a Vendor to narrow it.",
          "The cards show what is Waiting for a bill (with tax), the value Before tax and how many receipts have waited Over a month.",
          "Make the bill from the receipt on Purchase Invoices when the vendor's invoice arrives.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "Net", meaning: "What was accepted, less goods sent back for a debit note, at the purchase order's prices, before tax, in the company currency at the receipt date." },
      { name: "Waiting", meaning: "Days since the receipt date; more than a month shows in red." },
    ],
    rules: [
      "A receipt is billed once; a cancelled bill doesn't count, so its receipt shows here again.",
      "A receipt whose goods all went back for a debit note has nothing to bill and isn't listed.",
      "If finance can't be reached the report says so instead of listing every receipt.",
    ],
    related: [
      { route: "/purchaseInvoices", label: "Purchase Invoices" },
      { route: "/reports/open-purchase-orders", label: "Open Purchase Orders" },
    ],
  },
  {
    id: "vendor-performance",
    route: "/reports/vendor-performance",
    module: "Reports",
    title: "Vendor Performance",
    summary: "How each vendor did in a period: deliveries on time, goods rejected and sent back, how much was bought, and their prices against other vendors for the same products.",
    who: purchaseReader,
    tasks: [
      {
        title: "Compare vendors",
        steps: [
          "Choose the Period (it opens on this quarter) and, if you need to, a Vendor.",
          "The cards show On time and Rejected for all vendors, what was Bought and how many vendors delivered.",
          "The table shows each vendor's purchases, receipts, On time (with the average days late), Rejected, Sent back and Price vs average.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "On time", meaning: "Goods receipts on or before their order's expected delivery date, out of the receipts whose order has one." },
      { name: "Rejected", meaning: "Quantity refused at receipt, out of the quantity received." },
      { name: "Price vs average", meaning: "What the vendor charged against the average price paid to any vendor for the same products in the period, for products bought from more than one vendor. Minus is cheaper." },
    ],
    rules: [
      "Counts accepted goods receipts by receipt date; prices are after discount, before tax, in the company currency.",
      "A vendor whose products nobody else sold you has no price comparison (—).",
    ],
    related: [
      { route: "/reports/purchase-analysis", label: "Purchase Analysis" },
      { route: "/common/vendors", label: "Vendors" },
    ],
  },
  {
    id: "day-book",
    route: "/reports/day-book",
    module: "Reports",
    title: "Day Book",
    summary: "Every journal entry in the ledger for a period, oldest first, with each one's debit and credit lines: automatic postings from documents and entries made by hand.",
    who: financeReader,
    tasks: [
      {
        title: "Read the day book",
        steps: [
          "Choose the Period (at most a year) and, if you need to, a Source such as Customer receipt or Vendor bill.",
          "Each row is one entry: its number and source, then its lines, debits first (Dr) and credits indented (Cr), with the cost centre when there is one.",
          "The cards show the number of Entries, the Debits and the Credits, which should be equal.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print. The file has one row per line, so every debit and credit is there."] },
    ],
    rules: ["Amounts are in the company currency, as posted.", "The day book covers at most a year; use a shorter period for a busy company."],
    related: [
      { route: "/journalEntries", label: "Journal Entries" },
      { route: "/generalLedger", label: "General Ledger" },
    ],
  },
  {
    id: "cash-bank-book",
    route: "/reports/cash-bank-book",
    module: "Reports",
    title: "Cash & Bank Book",
    summary: "One cash box's or bank account's money in and out for a period, with the opening balance, the balance after each line and the closing balance: the cash book or the bank book.",
    who: financeReader,
    tasks: [
      {
        title: "Read a book",
        steps: [
          "Choose the Cash box or bank (it opens on the default account) and the Period.",
          "The cards show the Opening balance, Received, Paid and the Closing balance.",
          "Each line shows its Particulars (the other accounts of the entry, such as Receivables or Rent), the entry and its source, what was Received or Paid, and the Balance after it.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print. The file starts with the opening balance and ends with the totals and the closing balance."] },
    ],
    fields: [
      { name: "Balance", meaning: "The account's balance in the books after the line: its opening balance plus everything posted to it." },
      { name: "Own currency", meaning: "For an account in another currency, each amount and balance also shows in that currency, under the company-currency one." },
    ],
    rules: ["The balances are the same as Bank & Cash shows as Balance in books."],
    related: [
      { route: "/bankAccounts", label: "Bank & Cash" },
      { route: "/reports/receipts-payments", label: "Receipts & Payments" },
    ],
  },
  {
    id: "receipts-payments",
    route: "/reports/receipts-payments",
    module: "Reports",
    title: "Receipts & Payments",
    summary: "All the money that came in and went out of every cash box and bank account in a period, and what it was for: customer receipts, vendor payments, expenses, payroll and so on.",
    who: financeReader,
    tasks: [
      {
        title: "See where the money went",
        steps: [
          "Choose the Period and, if you need to, one Cash box or bank.",
          "The cards show Received, Paid, the Net and the Transfers between your own accounts.",
          "By what it was for adds up each kind of movement; the table lists every line with its account and particulars.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "For", meaning: "Where the entry came from: Customer receipt, Vendor payment, Expense or income, Payroll, Journal entry and so on." },
      { name: "Transfer", meaning: "Money moved between two of your own cash boxes or bank accounts. It is listed but not counted as received or paid." },
    ],
    rules: ["Amounts are in the company currency, as posted to the ledger."],
    related: [
      { route: "/reports/cash-bank-book", label: "Cash & Bank Book" },
      { route: "/paymentReceipts", label: "Payment Receipts" },
    ],
  },
  {
    id: "customer-ledger",
    route: "/reports/customer-ledger",
    module: "Reports",
    title: "Customer Ledger",
    summary: "One customer's account for a period: the opening balance, every invoice, payment, credit note and reversal, and the balance after each, in the documents' own currency.",
    who: financeReader,
    tasks: [
      {
        title: "Read a customer's ledger",
        steps: [
          "Choose the Customer and the Period (it opens on this year).",
          "The cards show the Opening balance, the Debits (invoiced), the Credits (received and credited) and the Closing balance the customer owes.",
          "Grey lines are shown for reference and don't change the balance.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print to send the customer their statement."] },
    ],
    rules: ["It is the same statement as on Accounts Receivable, with a running balance and export."],
    related: [
      { route: "/accountsReceivable", label: "Accounts Receivable" },
      { route: "/reports/vendor-ledger", label: "Vendor Ledger" },
    ],
  },
  {
    id: "vendor-ledger",
    route: "/reports/vendor-ledger",
    module: "Reports",
    title: "Vendor Ledger",
    summary: "One vendor's account for a period: the opening balance, every bill, debit note, payment and advance, and what you owe after each, in the documents' own currency.",
    who: financeReader,
    tasks: [
      {
        title: "Read a vendor's ledger",
        steps: [
          "Choose the Vendor and the Period (it opens on this year).",
          "The cards show the Opening balance, the Debits (paid and debited), the Credits (billed) and the Closing balance you owe.",
          "Grey lines are shown for reference only: an advance used on a bill, a debit note already left out of its bill, a cancelled cheque.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print, for example to agree balances with the vendor."] },
    ],
    rules: [
      "Bills count on their bill date, opening bills (from Data Import) included; cancelled, void and rejected bills don't.",
      "Payments awaiting approval or rejected don't count. An advance lowers what you owe when it is paid; using it on a bill only moves it.",
      "If the vendor's documents are in more than one currency, the report says so.",
    ],
    related: [
      { route: "/accountsPayable", label: "Accounts Payable" },
      { route: "/vendorPayments", label: "Vendor Payments" },
    ],
  },
  {
    id: "expenses-by-account",
    route: "/reports/expenses",
    module: "Reports",
    title: "Expenses by Account",
    summary: "What every expense account took in a period, by account, cost centre or month, with each one's breakdown and share.",
    who: financeReader,
    tasks: [
      {
        title: "Analyse expenses",
        steps: [
          "Choose the Period and, if you need to, a Cost centre (or No cost centre).",
          "Pick By account, By cost centre or By month. Each row shows its breakdown: an account by cost centre, a cost centre or month by account.",
          "Click a row to look closer: an account shows its months, a cost centre its accounts.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "Amount", meaning: "Debits less credits on expense accounts, in the company currency; refunds and corrections lower it." },
      { name: "Without a cost centre", meaning: "Expense lines not charged to a cost centre." },
    ],
    rules: ["Year-end closing entries are left out.", "Cost of goods sold is an expense account, so it is included."],
    related: [
      { route: "/costCentres", label: "Cost Centres" },
      { route: "/financialStatements", label: "Financial Statements" },
    ],
  },
  {
    id: "headcount",
    route: "/reports/headcount",
    module: "Reports",
    title: "Headcount",
    summary: "How many people the company had at the start and end of a period, who joined and who left, by department and month, and the turnover.",
    who: [{ role: "HR and managers (HRM approve right)", can: "Read the report. Excel, PDF and Print need the HRM export right." }],
    tasks: [
      {
        title: "Read the headcount",
        steps: [
          "Choose the Period (it opens on this year) and, if you need to, a Department.",
          "The cards show the Opening and Closing headcount, the Joiners, the Leavers and the Turnover, with the closing headcount by employment type.",
          "The chart shows the headcount at each month's end; the table shows each department; Joiners and Leavers list the people, with each leaver's months of service.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print for the department table."] },
    ],
    fields: [
      { name: "Turnover", meaning: "Leavers out of the average of the opening and closing headcount, in %." },
      { name: "Leaving date", meaning: "The last working day, or the exit date when there is none." },
    ],
    rules: [
      "Someone counts from their joining date to their leaving date; opening + joiners − leavers = closing.",
      "An employee made inactive without an exit date can't be placed, so they are left out, with a note saying how many.",
    ],
    related: [
      { route: "/employeeRecords", label: "Employees" },
      { route: "/reports/payroll-register", label: "Payroll Register" },
    ],
  },
  {
    id: "payroll-register",
    route: "/reports/payroll-register",
    module: "Reports",
    title: "Payroll Register",
    summary: "What each employee was paid in the months of a period, from the payroll runs: gross, deductions, net pay and the employer's contributions, by employee, department or month.",
    who: [{ role: "HR and managers (HRM approve right)", can: "Read the report. Excel, PDF and Print need the HRM export right." }],
    tasks: [
      {
        title: "Read the register",
        steps: [
          "Choose the Period (its months count) and, if you need to, a Department.",
          "Pick By employee, By department or By month. For employees and departments the table shows each month's net pay.",
          "The cards show Gross, Deductions (with loss of pay), Net pay and Employer contributions.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print; the file has every month's net pay."] },
    ],
    rules: [
      "Only salaries of processed payroll runs count. A run still waiting for approval is left out, with a warning.",
      "If the employee list can't be read, employees show by their number.",
    ],
    related: [
      { route: "/payrollSummary", label: "Payroll Summary" },
      { route: "/reports/headcount", label: "Headcount" },
    ],
    byRegion: {
      IN: {
        fields: [{ name: "Employer contributions", meaning: "What the company pays on top of gross pay: the employer's PF and ESI." }],
      },
      GCC: {
        fields: [{ name: "Employer contributions", meaning: "What the company pays on top of gross pay: the employer's share of pension and social insurance (UAE GPSSA or ADPF, Saudi Arabia GOSI)." }],
      },
    },
  },
  {
    id: "leave-balances",
    route: "/reports/leave-balances",
    module: "Reports",
    title: "Leave Balances",
    summary: "Every employee's leave of one leave year, by leave type: what they are entitled to, what they have taken and what is left.",
    who: [{ role: "Leave approvers (Attendance approve right)", can: "Read the report. Excel, PDF and Print need the Attendance export right." }],
    tasks: [
      {
        title: "Read the balances",
        steps: [
          "Choose the Leave year (it opens on the latest) and, if you need to, a Leave type.",
          "The cards show each leave type's days left and days taken of those entitled.",
          "Each cell shows the days left, with the days taken of those entitled under it; point at it for the days waiting for approval.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print. The file has entitled, taken, waiting and left for every leave type."] },
    ],
    fields: [
      { name: "Entitled", meaning: "Allocated, plus carried forward, plus adjustments." },
      { name: "Left", meaning: "The balance as kept: leave waiting for approval is already taken off." },
    ],
    rules: ["Year closed marks an employee whose leave year has been closed."],
    related: [
      { route: "/att_attendanceApproval", label: "Leave Approvals" },
      { route: "/att_leaveType", label: "Leave Types" },
    ],
  },
  {
    id: "stock-aging",
    route: "/reports/stock-aging",
    module: "Reports",
    title: "Stock Aging",
    summary: "The stock on hand today by how long it has been in: 0–30, 31–60, 61–90, 91–180 and 181–365 days, over a year, or of unknown age, with its value and when each product last sold.",
    who: [{ role: "Anyone with Inventory access", can: "Read the report. Excel, PDF and Print need the Inventory export right." }],
    tasks: [
      {
        title: "Find old stock",
        steps: [
          "The cards show the Stock value, what is Over 90 days, Over a year and of Unknown age.",
          "The table shows each product's value on hand, the quantity in each age band and when it last sold.",
          "Sort by an age band or by Last sold to find slow and old stock.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    rules: [
      "Stock goes out oldest first, so what is on hand is matched to the newest receipts; stock no receipt explains (from before the movement history) is of unknown age.",
      "Only your own warehouses count, not vendors' consignment stock. Transfers between warehouses don't make stock younger. Values are at the average cost.",
    ],
    related: [
      { route: "/inventory-report", label: "Inventory Report" },
      { route: "/reports/abc-analysis", label: "ABC Analysis" },
    ],
  },
  {
    id: "abc-analysis",
    route: "/reports/abc-analysis",
    module: "Reports",
    title: "ABC Analysis",
    summary: "Products ranked by what their sales cost in a period: class A is the first 80% of that value, B the next 15%, C the rest; products held in stock that didn't sell are listed apart.",
    who: [{ role: "Anyone with Inventory access", can: "Read the report. Excel, PDF and Print need the Inventory export right." }],
    tasks: [
      {
        title: "Rank products",
        steps: [
          "Choose the Period (it opens on this year).",
          "The cards show each class's cost of sales and share, and the stock held of products with No sales.",
          "The table lists each product with its class, quantity sold, cost of sales, share, cumulative share and the stock held.",
        ],
      },
      { title: "Export or print", steps: ["Click Excel, PDF or Print."] },
    ],
    fields: [
      { name: "Cost of sales", meaning: "Sales issues at cost less customer returns in the period, as in the Inventory Report." },
      { name: "Cumulative", meaning: "The share of the period's cost of sales of this product and every one above it." },
    ],
    rules: ["A product's class is decided by the share before it: under 80% A, under 95% B, the rest C."],
    related: [
      { route: "/reports/stock-aging", label: "Stock Aging" },
      { route: "/reports/gross-margin", label: "Gross Margin" },
    ],
  },
  {
    id: "inventory-report",
    route: "/inventory-report",
    module: "Reports",
    title: "Inventory Report",
    summary: "Stock reports from the live stock records: current stock, low stock, valuation, reservations, movements, cost of goods sold, adjustments, fast / slow / dead stock, batches, serial numbers and inspections.",
    who: moduleReader("Inventory"),
    tasks: [
      { title: "Choose a report", steps: ["Choose the Report, the Warehouse (or All warehouses) and, for movements and costs, the Period (last 30 days to 12 months)."] },
    ],
    fields: [
      { name: "Stock Valuation", meaning: "Stock on hand × its weighted-average cost from purchase receipts; stock with no cost yet uses the product's standard cost." },
      { name: "Cost of Goods Sold", meaning: "What the goods sold in the period cost: dispatches at the average cost when they left, less customer returns." },
      { name: "Fast / Slow / Dead Stock", meaning: "Fast = top third by quantity issued, Slow = the rest, Not issued = received or moved but not issued, Dead = no movement at all." },
    ],
    rules: ["Low Stock & Reorder: order at least the shortfall to get back to the reorder level.", "Batches & Expiry: expiring soon = within 30 days."],
    related: [
      { route: "/inventory", label: "Stock on Hand" },
      { route: "/purchase-service/reorder", label: "Reorder Suggestions" },
    ],
  },
  {
    id: "vat-return",
    route: "/vatReturn",
    module: "Reports",
    regions: ["GCC"],
    title: "VAT Return",
    summary: "The figures for your VAT return, box by box: output VAT on supplies and input VAT you can recover, with the documents behind each box.",
    who: moduleReader("Invoice"),
    tasks: [
      {
        title: "Prepare the return",
        steps: [
          "Choose the period (this month, last month, this quarter, last quarter or custom).",
          "Read each box (standard-rated, zero-rated and exempt supplies, reverse charge, credit notes, expenses and imports) and open its Documents to check them.",
          "Enter the figures on the tax authority's portal, then lock the period on Posting Accounts.",
        ],
      },
    ],
    rules: [
      "The company must be set as VAT registered, with its TRN, in Company Settings.",
      "Zero-rated exports without proof of exit after 90 days are flagged: record the proof on Export Evidence, or they are taxed at the standard rate.",
      "Documents in a foreign currency use the exchange rate of their date.",
    ],
    related: [
      { route: "/exportEvidence", label: "Export Evidence" },
      { route: "/postingAccounts", label: "Posting Accounts", why: "Lock the period" },
      { route: "/taxTypes", label: "Tax Types" },
    ],
    flows: ["month-end"],
  },
];

export const SETTINGS_TOPICS: HelpTopic[] = [
  {
    id: "my-profile",
    route: "/profile",
    module: "Settings",
    title: "My Profile",
    summary: "Your own account: photo, name, emails, designation and social links, and the company you belong to.",
    who: [{ role: "Everyone", can: "Their own profile." }],
    tasks: [
      { title: "Change your photo", steps: ["Click Change photo and choose an image (up to 20 MB); crop it and save."] },
      { title: "Update your details", steps: ["Click Edit Info under Personal Information: first and last name, emails and designation."] },
      { title: "Language, time zone, date format", steps: ["Open My preferences from your name at the top right."] },
    ],
    related: [{ route: "/my-preferences", label: "My preferences" }],
  },
  {
    id: "users",
    route: "/role_config",
    module: "Settings",
    title: "Users",
    summary: "Everyone who signs in: add them, give them roles, link them to their employee record, and switch them off when they leave.",
    who: [
      { role: "Tenant Administrator", can: "Everything on the page." },
      { role: "Users manager", can: "Add users (create right), change roles, resend invites and reset two-step sign-in (update right); only roles within their own rights." },
    ],
    tasks: [
      {
        title: "Add a user",
        steps: [
          "Click Add user: First name, Last name, Email, Designation.",
          "Link their Employee record so attendance and HR self-service work for them.",
          "Tick their Roles and save. No password is set here: they get an email to choose their own.",
        ],
      },
      { title: "Change someone", steps: ["Click Edit: role and employee changes apply from their next sign-in."] },
      { title: "Lost phone", steps: ["Click Reset two-step sign-in: they sign in with their password and set it up again."] },
      { title: "Someone leaves", steps: ["Click Deactivate; Activate brings them back."] },
    ],
    statuses: [
      { name: "Active", meaning: "Can sign in." },
      { name: "Invite pending", meaning: "Hasn't set a password yet; resend the invite if needed." },
      { name: "Inactive", meaning: "Can't sign in." },
    ],
    rules: [
      "A user with permissions beyond yours shows as Restricted: only a higher administrator can change their account.",
      "Without a role a user can only use self-service.",
      "The invite email needs the user service's mail settings.",
    ],
    related: [
      { route: "/rolesPermissions", label: "Roles & Permissions" },
      { route: "/employeeRecords", label: "Employees" },
    ],
    flows: ["company-setup"],
  },
  {
    id: "roles-permissions",
    route: "/rolesPermissions",
    module: "Settings",
    title: "Roles & Permissions",
    summary: "What each role may do, module by module (view, create, update, delete, approve, export and admin), and narrowed page by page under Page access.",
    who: [
      { role: "Tenant Administrator", can: "Add, change and delete custom roles." },
      { role: "Everyone with Users access", can: "See the roles." },
    ],
    tasks: [
      { title: "See a role", steps: ["Select a role to see its permissions."] },
      { title: "Make a role", steps: ["Click New role and name it (e.g. Sales Executive).", "Tick the permissions per Module and save."] },
      { title: "Change or remove one", steps: ["Click Edit role, or Delete the role (custom roles only). Not assigned counts the roles nobody has."] },
      {
        title: "Limit pages",
        steps: [
          "Edit the role and open Page access: the menu as the sidebar shows it, menu by menu, with View, Create, Edit, Delete, Approve and Export for each page.",
          "Untick what the role may not do on a page (untick View to hide the page). A changed page is highlighted; its reset button makes it follow the module rights again.",
          "Use Search pages or Only pages limited for this role to find pages, then Save role.",
        ],
      },
    ],
    rules: [
      "Greyed boxes are permissions you don't hold or don't administer: nobody can give more than they have.",
      "Admin includes every action of its module.",
      "System roles (with a lock) come from the platform: only the Super Admin can change them.",
      "A page can only allow what its module rights allow; pages nobody changed follow the module rights, so existing roles work as before.",
      "With several roles, an action is allowed on a page when any role holding that module right leaves it on there.",
      "The services refuse a switched-off create, edit, delete, approve or export on that page; lists that other pages also use stay readable. Users get changes from their next sign-in or token refresh.",
    ],
    related: [{ route: "/role_config", label: "Users" }],
  },
  {
    id: "getting-started",
    route: "/getting-started",
    module: "Settings",
    title: "Getting started",
    summary: "The steps to set up a new company: company and region, chart of accounts, bank and cash accounts, opening data and first users.",
    who: [{ role: "Tenant Administrator", can: "Set up the company." }],
    tasks: [
      {
        title: "Set up the company",
        steps: [
          "Work down the steps; each button opens the page for it (Open Company Settings, Review the accounts, Add a bank account, Open Data Import, Invite users).",
          "Steps are ticked off from what the system shows; some can be confirmed or skipped by hand. Click Check again after doing one.",
        ],
      },
    ],
    statuses: [
      { name: "Done", meaning: "Set up." },
      { name: "Skipped", meaning: "Left out on purpose; it can be reopened." },
    ],
    related: [
      { route: "/company-settings", label: "Company Settings" },
      { route: "/data-import", label: "Data Import" },
    ],
    flows: ["company-setup"],
  },
  {
    id: "company-settings",
    route: "/company-settings",
    module: "Settings",
    title: "Company Settings",
    summary: "Everything about the company: legal details, region and formats, tax registration, logo and colour, sign-in rules, AI, the company's own address, plan, data export and retention.",
    who: TENANT_ADMIN,
    tasks: [
      {
        title: "Company and region",
        steps: [
          "Enter the company's details, Country, State, Currency and Decimal places, then Language, Time zone, Date format, Time format, Number format, Week starts on, Financial year starts in and Weekend days.",
          "Choose the Tax registration (VAT registered, GST registered or not registered) with its number. Show Hijri dates adds the Umm al-Qura date on documents. Save.",
        ],
      },
      { title: "Logo and colour", steps: ["Upload the logo (PNG, JPEG or WebP up to 512 KB): it prints on invoices, quotations, payslips and PDF exports.", "Pick the Company colour and a Browser tab icon."] },
      { title: "Sign-in", steps: ["Choose Two-step sign-in: off, optional, required for administrators or for everyone.", "Set up single sign-on with Microsoft Entra ID or Google: the client secret, Directory (tenant) ID and email domains."] },
      { title: "AI", steps: ["Tick Use AI (Claude, by Anthropic) to let Finance read vendor bills and everyone use Ask MyTrade."] },
      { title: "Your own domain", steps: ["Enter your domain (e.g. erp.yourcompany.com), add the DNS records shown, click Check DNS now, then ask your provider to switch on HTTPS."] },
      {
        title: "Export and retention",
        steps: [
          "Click Export all data for all the company's records (CSV files in one ZIP) and Download it when ready.",
          "Set how many days to keep entries such as the audit log; older ones are deleted every night.",
        ],
      },
    ],
    rules: [
      "The currency is Locked once the company has quotations, invoices or other transactions.",
      "Invoices, the ledger, stock and payroll records are never deleted automatically (tax law needs them kept).",
      "The export leaves out passwords, keys and other secrets, and pictures and attached files.",
      "Plan, users and storage limits are shown here; to change the plan, contact your provider.",
      "The Country decides which country's rules the payroll pages, the menu and this help follow: India, or the Gulf (UAE, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait).",
    ],
    related: [
      { route: "/getting-started", label: "Getting started" },
      { route: "/notification-settings", label: "Notification Settings" },
    ],
    flows: ["company-setup"],
    byRegion: {
      IN: {
        tasks: [
          {
            title: "GST registration",
            steps: ["Choose Tax registration GST registered (India) and enter the GSTIN; the PAN is filled from the GSTIN if left empty.", "Pick the State from the list and enter the 6-digit PIN code."],
          },
        ],
        rules: ["With Country India, payroll follows India's rules (income tax, IT declarations, PF, ESI, professional tax), the financial year usually starts in April, and the menu and help show the India pages."],
      },
      GCC: {
        tasks: [
          {
            title: "VAT registration and licence",
            steps: [
              "Choose Tax registration VAT registered and enter the VAT registration number (TRN): 15 digits in the UAE and Saudi Arabia. It prints on tax invoices.",
              "Enter the Trade licence number and who it was Issued by: UAE e-invoices identify the seller by them.",
              "Enter the registered address the country's way: UAE emirate and P.O. Box; Saudi national address (building number, street, district, additional number, postal code), which ZATCA e-invoices carry.",
            ],
          },
        ],
        rules: [
          "With a Gulf country, payroll follows Gulf rules (no income tax; pension and social insurance for nationals, end-of-service gratuity, WPS and Mudad files), and the menu and help show the Gulf pages.",
          "Show Hijri dates is for companies that also want the Umm al-Qura date on documents (common in Saudi Arabia).",
        ],
      },
    },
  },
  {
    id: "notification-settings",
    route: "/notification-settings",
    module: "Settings",
    title: "Notification Settings",
    summary: "Which alerts are also emailed, and the automatic payment reminders customers get, with their text.",
    who: TENANT_ADMIN,
    tasks: [
      { title: "Choose the emails", steps: ["Tick Email approvers, Email low stock and Email overdue invoices. Everyone still sees their alerts under the bell at the top."] },
      {
        title: "Payment reminders",
        steps: [
          "Tick Send automatic payment reminders and set the Days before the due date (0 = none), Then every (days) and At most (overdue reminders).",
          "Enter Replies go to (empty: the company email on the invoice).",
          "Change the Subject and Message templates if you like (Use built-in text restores them), then Save template.",
        ],
      },
    ],
    rules: ["Reminders are emailed in the morning (company time) to the customer email on each unpaid invoice; Send payment reminder on Invoices sends one by hand."],
    related: [{ route: "/invoices", label: "Invoices" }],
  },
  {
    id: "audit-log",
    route: "/audit-log",
    module: "Settings",
    title: "Audit Log",
    summary: "Who did what and when: every important change in every module, with the fields before and after.",
    who: TENANT_ADMIN,
    tasks: [
      {
        title: "Find a change",
        steps: ["Choose From and To, the module, action and user, and search (invoice no., name…).", "Click Details for the fields that changed: Before and After."],
      },
    ],
    rules: ["Entries are kept for the retention set in Company Settings."],
    related: [{ route: "/company-settings", label: "Company Settings" }],
  },
  {
    id: "api-keys",
    route: "/api-keys",
    module: "Settings",
    title: "API keys",
    summary: "Keys that let other programs (a web shop, Power BI, Shopify) read and write your data, each limited to what you tick.",
    who: TENANT_ADMIN,
    tasks: [
      {
        title: "Make a key",
        steps: [
          "Click New API key: the Name (the program that uses it), Expires on (empty: until revoked) and What it may do.",
          "Click Make the key and copy it now: it is shown only this once.",
        ],
      },
      { title: "Stop a key", steps: ["Click Revoke: programs using it stop within 15 minutes."] },
    ],
    rules: [
      "A key can do only what you may grant yourself; user administration and Admin rights stay with people.",
      "Keep a key like a password: anyone with it can do what the key allows.",
      "For developers: the page explains how to trade the key for a 15-minute token and call the API.",
    ],
    related: [{ route: "/webhooks", label: "Webhooks" }],
  },
  {
    id: "webhooks",
    route: "/webhooks",
    module: "Settings",
    title: "Webhooks",
    summary: "Tell another program when something happens (an order, an invoice…): MyTrade calls its address for the events you tick.",
    who: TENANT_ADMIN,
    tasks: [
      {
        title: "Add a webhook",
        steps: ["Click Add webhook: the Address (https), a Description and the Events.", "Save and give the signing secret shown to the receiving program: it is shown only now."],
      },
      { title: "Check it works", steps: ["Click Send a test, then the Delivery log: each call's attempts and answer. Send again repeats one."] },
    ],
    rules: [
      "The receiver must answer with any 2xx within 10 seconds; otherwise the call is tried again after 1, 5 and 15 minutes, then 1, 3, 6 and 12 hours.",
      "New signing secret stops the old one at once.",
    ],
    related: [{ route: "/api-keys", label: "API keys" }],
  },
  {
    id: "customer-portal",
    route: "/portal-accounts",
    module: "Settings",
    title: "Customer Portal",
    summary: "Let a contact at a customer sign in to see that customer's invoices, payments, credit notes and statement, and download the PDFs. They can't see anything else or change anything.",
    who: [{ role: "Users managers", can: "Invite contacts and stop their access." }],
    tasks: [
      { title: "Invite a contact", steps: ["Click Invite a contact: the Customer, First name, Last name and Email, then Send invitation."] },
      { title: "Manage access", steps: ["Send the invitation again, Stop access, or Restore access on the row."] },
    ],
    related: [{ route: "/customer-management", label: "Customers" }],
  },
  {
    id: "data-import",
    route: "/data-import",
    module: "Settings",
    title: "Data Import",
    summary: "Bring your existing records in from Excel: products, customers and vendors, then opening stock, unpaid invoices and bills, and ledger balances on the go-live date.",
    who: [{ role: "Anyone with the right to create the records", can: "Import them; each import shows the permission it needs." }],
    tasks: [
      {
        title: "Import a file",
        steps: [
          "Choose what to import and click Download template; read Columns in this template (required, examples, notes).",
          "Fill it in and upload it. Every row is checked first.",
          "If problems are listed, nothing was saved: fix them in the file (Download list) and upload it again.",
          "Check the First rows, as they will be saved, and click Import.",
        ],
      },
    ],
    rules: ["Nothing is saved until the whole file is right.", "Past imports lists what was imported, by whom."],
    related: [{ route: "/getting-started", label: "Getting started" }],
    flows: ["company-setup"],
  },
  {
    id: "platform-tenants",
    route: "/platform/tenants",
    module: "Settings",
    title: "Tenants & Modules",
    summary: "Every company on the platform: create one with its modules and first administrator, change its plan or modules, and suspend, close or reactivate it.",
    who: SUPER_ADMIN,
    tasks: [
      {
        title: "Create a company",
        steps: [
          "Click New tenant: the Company name, Company address (its own sign-in address), Plan (or modules) and the Tenant Administrator's name and email.",
          "They get an email to set their own password, then fill in the company details under Company Settings.",
        ],
      },
      { title: "Change one", steps: ["Edit name and modules; Plan, limits and prices; Change status (suspend, close or reactivate). Resend invite for an administrator who hasn't signed in."] },
      { title: "Work inside one", steps: ["Choose it in Working in at the top; Switch to all tenants goes back."] },
    ],
    rules: ["Users is a core module and is always on."],
    related: [{ route: "/platform/plans", label: "Plans" }],
  },
  {
    id: "platform-plans",
    route: "/platform/plans",
    module: "Settings",
    title: "Plans",
    summary: "The plans companies subscribe to: modules, limits (users, storage, AI uses) and prices.",
    who: SUPER_ADMIN,
    tasks: [
      {
        title: "Make a plan",
        steps: [
          "Click New plan: Code, Name, Description, Modules, Most users, Most storage (MB), AI uses a month, Monthly price, Yearly price, Currency.",
          "Tick Active (can be given to companies) and save.",
        ],
      },
      { title: "See who is on it", steps: ["Click Show the companies on this plan."] },
    ],
    rules: [
      "A company's modules follow its plan; agree different limits or prices for a company on Tenants & Modules.",
      "Billing events go to the billing system's webhook; failed ones are retried every 10 minutes, 5 times.",
    ],
    related: [{ route: "/platform/tenants", label: "Tenants & Modules" }],
  },
];
