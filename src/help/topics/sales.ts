import type { HelpRole, HelpTopic } from "../types";

// Who can do what on the Sales pages. SALES:APPROVE (Sales Manager) is checked by the server too.
const SALES_WHO: HelpRole[] = [
  { role: "Sales Manager", can: "Everything, including approving: accept or reject quotations, confirm orders and dispatches, release credit holds, cancel or close orders short, POS returns." },
  { role: "Sales Executive", can: "Add and edit quotations, orders, returns and the rest; send quotations and dispatch goods. Not approve, delete or export." },
];

// Sales: from the quotation to the dispatched order, the counter, online stores, returns and the sales team (menu: Sales).
export const SALES_TOPICS: HelpTopic[] = [
  {
    id: "sales-dashboard",
    route: "/sales-dashboard",
    module: "Sales",
    title: "Sales Dashboard",
    summary: "A view of sales at a glance: total sales, orders, customers and top products, monthly sales, and shortcuts to the Sales and Service pages.",
    who: [{ role: "Anyone with Sales access", can: "Read the dashboard. It shows only figures, nothing can be changed here." }],
    tasks: [
      { title: "See how sales are going", steps: ["Read the cards at the top: Total Sales, Total Orders, Total Customers and Top Products.", "Check the Monthly sales chart and the Monthly sales data table below it.", "Use Top products to see what sells most."] },
      { title: "Go to a Sales page", steps: ["Click a shortcut under Sales or Service to open that page."] },
    ],
    rules: ["The figures come from the sales report, so they count orders as they are recorded in Sales Orders."],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/quotations", label: "Quotations" },
    ],
    flows: ["order-to-cash"],
  },
  {
    id: "quotations",
    route: "/quotations",
    module: "Sales",
    title: "Quotations",
    summary: "Price offers to customers. A quotation goes Draft → Sent → Accepted or Rejected; an accepted one becomes a sales order with one click.",
    who: SALES_WHO,
    tasks: [
      {
        title: "Make a quotation",
        steps: [
          "Click Add Quotation (or open a deal in CRM and create the quotation from it: the customer and lines are filled in).",
          "Choose the customer: type a name or code. The currency comes from the customer.",
          "Set the Sales Person, Quote Date and Valid Until.",
          "Add the lines: product or service, quantity, price and discount. Prices come from the customer's own price or price list, else the catalogue.",
          "Fill payment terms, credit days, delivery terms and the notes the customer should see; Internal Notes stay inside the company.",
          "Save. It is a Draft and can still be edited.",
        ],
      },
      {
        title: "Send it to the customer",
        steps: [
          "Click Email quotation to the customer: the PDF goes with the email, and a draft becomes Sent.",
          "Or choose Sent in the status box if you gave it another way. Export quotation as PDF downloads it.",
        ],
      },
      { title: "Record the customer's answer", steps: ["A Sales Manager sets the status to Accepted or Rejected."], who: "Sales Manager" },
      { title: "Turn it into an order", steps: ["On an accepted quotation click Convert to sales order.", "The order opens in Sales Orders as a Draft with the same customer and lines."] },
    ],
    fields: [
      { name: "Customer Reference", meaning: "The customer's PO or enquiry number; printed on the quotation." },
      { name: "Valid Until", meaning: "The last day the prices hold." },
      { name: "Customer Notes / Terms and Conditions", meaning: "Printed on the quotation." },
      { name: "Internal Notes", meaning: "Only for your team; not shown to the customer." },
    ],
    statuses: [
      { name: "Draft", meaning: "Being prepared; the only status that can be edited." },
      { name: "Sent", meaning: "Given to the customer; waiting for an answer." },
      { name: "Accepted", meaning: "The customer agreed (set by a Sales Manager). Can be converted to a sales order." },
      { name: "Rejected", meaning: "The customer said no." },
    ],
    rules: [
      "Only drafts can be edited: change a sent quotation by making a new one.",
      "Accepting or rejecting needs SALES:APPROVE (a Sales Manager).",
      "A price typed on a line stays; otherwise the line takes the customer price, the price list price, or the catalogue price.",
    ],
    related: [
      { route: "/opportunities", label: "Deals", why: "Quotations can start from a deal." },
      { route: "/sales-orders", label: "Sales Orders", why: "Where an accepted quotation goes." },
      { route: "/sales-price-lists", label: "Price Lists", why: "Where the line prices come from." },
    ],
    flows: ["lead-to-order", "order-to-cash"],
  },
  {
    id: "sales-orders",
    route: "/sales-orders",
    module: "Sales",
    title: "Sales Orders",
    summary:
      "Orders the customer has placed. A Sales Manager confirms an order to reserve stock; the goods then go out in one or more dispatches, and each confirmed dispatch can be invoiced.",
    who: SALES_WHO,
    tasks: [
      {
        title: "Add an order",
        steps: [
          "Click Add Order, or convert an accepted quotation.",
          "Choose the customer, order date and due date; the currency comes from the customer.",
          "Add the items with quantities and prices (at least one is required).",
          "Check the billing and shipping addresses and where the goods go (for a designated zone, enter it; for imports, the customs entry no.).",
          "Save. The order is a Draft.",
        ],
      },
      {
        title: "Confirm the order",
        steps: [
          "Click Confirm order (reserve stock) and choose the warehouse the products come from.",
          "If the order is over the customer's available credit it shows Credit hold: a Sales Manager other than the person who raised it can Release credit hold with a reason.",
        ],
        who: "Sales Manager",
      },
      {
        title: "Dispatch the goods",
        steps: [
          "On a confirmed order click Dispatch goods.",
          "Enter the quantity going out now for each line (less than ordered is fine: the rest stays pending).",
          "Save the dispatch. A Sales Manager confirms it: the stock leaves the warehouse and the dispatch can be invoiced.",
        ],
      },
      { title: "Give a proforma invoice", steps: ["Click Proforma invoice to print or email it, for example to ask for an advance."] },
      {
        title: "Stop an order",
        steps: [
          "Nothing delivered yet: Cancel order, with a reason. The reserved stock is released.",
          "Part delivered: Close short, with a reason. The rest won't be delivered and its stock is released.",
        ],
        who: "Sales Manager",
      },
    ],
    fields: [
      { name: "Paid / Balance Amount", meaning: "What the customer has paid against the order and what is left." },
      { name: "Where the goods go", meaning: "Local, export or a designated zone; decides the VAT treatment." },
      { name: "Sales Channel / Sales Person", meaning: "Used for the sales reports, targets and commission." },
    ],
    statuses: [
      { name: "Draft", meaning: "Just entered; can be edited or deleted. May be on Credit hold." },
      { name: "Confirmed", meaning: "Approved and stock reserved; ready to dispatch." },
      { name: "Partially delivered", meaning: "Some items have gone out; the rest are pending." },
      { name: "Delivered", meaning: "Everything has gone out." },
      { name: "Cancelled", meaning: "Stopped before anything was delivered." },
      { name: "Closed short", meaning: "Shown under the status when the rest of a part-delivered order was dropped." },
    ],
    rules: [
      "Only drafts can be edited; only drafts and cancelled orders can be deleted.",
      "Dispatch goods only from this page. A draft dispatch doesn't count as delivered until it is confirmed.",
      "Services are dispatched too (as delivered), without stock.",
      "A customer with no credit limit is never held; the limit is set on the customer.",
    ],
    related: [
      { route: "/quotations", label: "Quotations" },
      { route: "/credit-limit", label: "Credit Limit" },
      { route: "/return-requests", label: "Return Requests", why: "When the customer sends goods back." },
    ],
    flows: ["order-to-cash", "sales-returns"],
  },
  {
    id: "sales-pos",
    route: "/sales-pos",
    module: "Sales",
    title: "Point of Sale",
    summary: "Sell at the counter. Open a shift on a till, scan or search the items, take cash or card; each sale becomes a tax invoice. Close the shift by counting the cash.",
    who: [
      { role: "Cashier (Sales Executive)", can: "Open and close shifts, sell at the till price, print receipts, retry an invoice." },
      { role: "Supervisor (Sales Manager)", can: "Also sell below the price, give a discount and take returns." },
    ],
    tasks: [
      { title: "Set up a till", steps: ["Click Till settings.", "Enter the code, name and currency.", "Choose the warehouse it sells from and the walk-in customer.", "Choose where cash and card money go (or the company default).", "Save."] },
      { title: "Open a shift", steps: ["Choose the till.", "Enter the cash in the till at the start.", "Click Open shift."] },
      {
        title: "Make a sale",
        steps: [
          "Scan a barcode, or search by code or name, and pick the product.",
          "Change the quantity with − and +; enter the batch number or serial numbers when the product needs them.",
          "Leave the customer as Walk-in or choose one.",
          "Take the payment: Cash received, Card (with the card reference), Exact cash or All on card.",
          "Complete the sale; the change and the invoice number are shown. Print receipt from the shift's sales.",
        ],
      },
      { title: "Take a return", steps: ["Click Return on the sale (or find it by receipt or invoice number).", "Enter how many of each item are coming back and the reason.", "Choose Refund by cash or card, and whether the goods can be sold again.", "Click Make the return."], who: "Sales Manager" },
      { title: "Close the shift", steps: ["Click Close shift.", "Count the cash and enter it under Cash counted, with notes if needed.", "Close it: any difference is posted to the ledger."] },
    ],
    fields: [
      { name: "Prices", meaning: "Till prices can include tax (shelf prices); the invoice shows them net plus tax." },
      { name: "Float at the start", meaning: "The cash in the till when the shift opened." },
    ],
    statuses: [
      { name: "Invoice pending", meaning: "The goods are sold but the invoice couldn't be made yet: click Retry the invoice." },
    ],
    rules: [
      "Only a supervisor can sell below the price or give a discount.",
      "A return pays money back, so it needs SALES:APPROVE.",
      "If the cash difference couldn't be posted, the page shows it with Post it now.",
    ],
    related: [{ route: "/sales-orders", label: "Sales Orders" }],
    flows: ["pos-day"],
  },
  {
    id: "sales-online-stores",
    route: "/sales-online-stores",
    module: "Sales",
    title: "Online Stores",
    summary: "Connect Shopify, Salla, Zid, Amazon or noon. MyTrade sends them your stock, brings their orders in as sales orders every 5 minutes, and takes marketplace payouts to finance.",
    who: [
      { role: "Sales administrator (SALES:ADMIN)", can: "Connect, change or disconnect a store and make a new webhook secret." },
      { role: "Sales Manager / Executive", can: "Run a sync, link products and upload payout statements." },
    ],
    tasks: [
      {
        title: "Connect a store",
        steps: [
          "Click Connect a store and choose the platform.",
          "Follow the steps shown to get the platform's token, then enter the store address and token (and seller ID or warehouse code where asked).",
          "Choose the warehouse it sells from and the date to bring in orders from.",
          "Tick Confirm orders as they come in to reserve stock at once, or untick to check each draft first.",
          "For noon, copy the webhook address and secret into noon's developer portal straight away: the secret isn't shown again.",
        ],
      },
      { title: "Link the products", steps: ["Give every product in the store a SKU equal to its MyTrade product code.", "Use Link products by SKU."] },
      { title: "Upload a marketplace payout", steps: ["Click Upload a payout statement.", "Choose the CSV (download the template): Order number, Type, Amount and Description; the lines must add up to the amount paid out.", "Enter the statement number, period and paid-on date, and upload."] },
    ],
    rules: [
      "Orders come in as sales orders; dispatch and invoice them in Sales Orders as usual.",
      "A new webhook secret stops the old one working at once.",
    ],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/products", label: "Products", why: "The product code must match the store's SKU." },
    ],
    flows: ["order-to-cash"],
  },
  {
    id: "sales-price-lists",
    route: "/sales-price-lists",
    module: "Sales",
    title: "Price Lists",
    summary: "Special prices: price lists with quantity breaks, and a customer's own price for a product. Quotations and orders pick them up.",
    who: SALES_WHO,
    tasks: [
      {
        title: "Make a price list",
        steps: [
          "Add a price list with a name (e.g. Wholesale AED) and currency.",
          "Tick Default for this currency to use it for every customer without a list of their own.",
          "Add lines: product, from quantity and price. Add the same product again with a higher from-quantity for a quantity break (e.g. 1 → 40, 100 → 35).",
          "Save, then give the list to customers on the customer record.",
        ],
      },
      { title: "Give one customer a price", steps: ["Under customer prices, search the customer, choose the product and enter the price.", "Save."] },
    ],
    rules: [
      "Quotation lines take the customer's own price, else their price list's (the quantity break the quantity reaches), else the catalogue price.",
      "A rate typed on the line always stays.",
      "With no price lists, every customer gets the catalogue price.",
    ],
    related: [
      { route: "/quotations", label: "Quotations" },
      { route: "/customer-management", label: "Customers" },
    ],
  },
  {
    id: "credit-limit",
    route: "/credit-limit",
    module: "Sales",
    title: "Credit Limit",
    summary: "Check a customer's credit before you sell: their limit, what they owe and what is still available, with a history of credit actions.",
    who: [
      { role: "Sales Manager / Executive", can: "Check credit and see the history." },
      { role: "With SALES:EXPORT", can: "Export the credit history." },
    ],
    tasks: [
      { title: "Check a customer's credit for an order", steps: ["Choose the customer.", "Choose Check Credit and enter the order amount.", "Run Credit Check: it says whether the credit is sufficient and how much is available."] },
      { title: "See what is available", steps: ["Choose the customer and Get Available."] },
      { title: "Export the history", steps: ["Click Export history.", "Choose the date range and format, and download."] },
    ],
    fields: [
      { name: "Credit Limit", meaning: "Set on the customer. Empty means no limit." },
      { name: "Outstanding", meaning: "What the customer owes on unpaid invoices." },
      { name: "Available", meaning: "Credit limit minus outstanding." },
    ],
    rules: [
      "An order over the available credit is put on Credit hold in Sales Orders until a Sales Manager releases it.",
      "Outstanding follows the invoices and payments; Add / Clear Outstanding are manual corrections.",
    ],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/customer-management", label: "Customers", why: "Where the limit is set." },
    ],
    flows: ["order-to-cash"],
  },
  {
    id: "return-requests",
    route: "/return-requests",
    module: "Sales",
    title: "Return Requests",
    summary: "Goods a customer sends back after delivery. Approve the return, then refund the customer or exchange the items.",
    who: SALES_WHO,
    tasks: [
      {
        title: "Record a return",
        steps: [
          "Click Add Return Request.",
          "Choose the sales order (only delivered or invoiced orders) and the item, and enter the return quantity.",
          "Choose the reason and the resolution: Refund the customer, or Exchange (send the same items again).",
          "Leave Refund Amount blank to use the value of the returned items.",
          "Save. The return is Pending.",
        ],
      },
      { title: "Approve or reject it", steps: ["Change the status in the row to Approved or Rejected."] },
      {
        title: "Refund the customer",
        steps: [
          "On an approved refund return click Refund.",
          "Enter the refund date, payment method and the account it is paid from.",
          "When the refund is Processed, finance raises a credit note on the invoice: what the customer had paid is paid back; anything still owed is simply reduced.",
        ],
      },
      { title: "Complete an exchange", steps: ["Set an approved exchange to Completed: the same items go out again from the order's warehouse and the returned ones come back into stock (not when damaged)."] },
    ],
    fields: [
      { name: "Reason", meaning: "Damaged product, wrong item, customer changed mind, late delivery or other." },
      { name: "Resolution", meaning: "Refund or exchange. An exchange has no refund." },
    ],
    statuses: [
      { name: "Pending", meaning: "New; waiting for a decision." },
      { name: "Approved", meaning: "Accepted: refund it or complete the exchange." },
      { name: "Rejected", meaning: "Not accepted." },
      { name: "Completed", meaning: "Done. Set automatically once the refund is processed." },
    ],
    rules: [
      "Only goods that were delivered can come back.",
      "One refund per return.",
      "Completed and rejected returns can't be edited; only open or rejected returns without a processed refund can be deleted.",
    ],
    related: [
      { route: "/refunds", label: "Refunds" },
      { route: "/sales-orders", label: "Sales Orders" },
    ],
    flows: ["sales-returns"],
  },
  {
    id: "refunds",
    route: "/refunds",
    module: "Sales",
    title: "Refunds",
    summary: "Money given back for approved returns. Mark each refund Processed once it is paid, or Failed if it didn't go through.",
    who: SALES_WHO,
    tasks: [
      { title: "Add a refund", steps: ["Click Add Refund.", "Choose the return request (only approved ones not yet refunded).", "Enter the amount, refund date and payment method.", "Save. It is Pending."] },
      { title: "Mark it paid", steps: ["Change the status to Processed. The return becomes Completed and finance raises the credit note."] },
    ],
    statuses: [
      { name: "Pending", meaning: "Recorded, not paid yet." },
      { name: "Processed", meaning: "Paid back (or set off against what the customer owes)." },
      { name: "Failed", meaning: "The payment didn't go through." },
    ],
    rules: ["A return can have only one refund."],
    related: [{ route: "/return-requests", label: "Return Requests" }],
    flows: ["sales-returns"],
  },
  {
    id: "service-schedules",
    route: "/service-schedules",
    module: "Sales",
    title: "Service Schedules",
    summary: "Book service visits for sold orders: who goes, when, and how far the job has got.",
    who: SALES_WHO,
    tasks: [
      {
        title: "Book a visit",
        steps: ["Click Add schedule.", "Choose the service order and the customer.", "Choose the assigned employee, the scheduled date and the start and end times.", "Add remarks and save."],
      },
      { title: "Update the job", steps: ["Click Set status and choose the new status."] },
      { title: "Book a similar visit", steps: ["Click Copy to create on an existing schedule and change what differs."] },
    ],
    statuses: [
      { name: "Pending / Assigned / Accepted", meaning: "Booked; the employee has been given or has taken the job." },
      { name: "In progress", meaning: "The visit is under way." },
      { name: "Completed", meaning: "Done." },
      { name: "Cancelled", meaning: "Not going ahead." },
    ],
    related: [
      { route: "/service-schedule-notify", label: "Service Reminders" },
      { route: "/sales-orders", label: "Sales Orders" },
    ],
  },
  {
    id: "service-schedule-notify",
    route: "/service-schedule-notify",
    module: "Sales",
    title: "Service Reminders",
    summary: "Service visits with a notice to the assigned employee, so nobody forgets the job.",
    who: SALES_WHO,
    tasks: [
      { title: "Add a reminder", steps: ["Click Add Notify.", "Choose the sales order, the customer and the assigned employee.", "Set the scheduled date and remarks, and save: the employee is notified."] },
      { title: "Change who goes", steps: ["Edit the schedule and choose another employee."] },
    ],
    related: [{ route: "/service-schedules", label: "Service Schedules" }],
  },
  {
    id: "sales-persons",
    route: "/sales-persons",
    module: "Sales",
    title: "Sales Persons",
    summary: "The people who sell. Each sales person is a user with a region; orders, targets and commission are recorded against them.",
    who: SALES_WHO,
    tasks: [
      { title: "Add a sales person", steps: ["Click Add Sales Person.", "Select the user and the region.", "Save."] },
      { title: "Stop using a sales person", steps: ["Change their status to Inactive; they stay on the orders they already have."] },
    ],
    statuses: [
      { name: "Active", meaning: "Selling now." },
      { name: "Inactive", meaning: "No longer selling; kept for history." },
    ],
    rules: ["The same user can't be added twice."],
    related: [
      { route: "/sales-targets", label: "Sales Targets" },
      { route: "/quotations", label: "Quotations" },
    ],
  },
  {
    id: "sales-channels",
    route: "/sales-channels",
    module: "Sales",
    title: "Sales Channels",
    summary: "The ways you sell (direct, online and so on). Choose the channel on each order to see which ones bring the sales.",
    who: SALES_WHO,
    tasks: [{ title: "Add a channel", steps: ["Click Add Sales Channel.", "Enter the channel name, choose the channel type and add contact info.", "Save."] }],
    related: [{ route: "/sales-orders", label: "Sales Orders" }],
  },
  {
    id: "sales-targets",
    route: "/sales-targets",
    module: "Sales",
    title: "Sales Targets",
    summary: "Targets for each sales person by month or period, with the amount achieved and how far along they are.",
    who: SALES_WHO,
    tasks: [
      {
        title: "Set a target",
        steps: ["Click Add Target.", "Choose the sales person and target type.", "Enter the target amount, year and month (or a date range).", "Save."],
      },
      { title: "Update progress", steps: ["Edit the target and enter the achieved amount: the status follows the amounts.", "Or click Mark achieved when it is reached."] },
    ],
    fields: [{ name: "Achievement %", meaning: "Achieved amount ÷ target amount." }],
    statuses: [
      { name: "Not started", meaning: "Nothing achieved yet." },
      { name: "On track / Ongoing", meaning: "Some achieved, below the target." },
      { name: "Completed", meaning: "Target reached." },
      { name: "Exceeded", meaning: "More than the target." },
      { name: "Missed", meaning: "The period ended below the target." },
    ],
    related: [{ route: "/sales-persons", label: "Sales Persons" }],
  },
];
