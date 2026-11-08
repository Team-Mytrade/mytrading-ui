import type { HelpRole, HelpTopic } from "../types";

// Who can do what on the Purchase pages (purchase-service SecurityConfig): PURCHASE:APPROVE approves requisitions and
// orders, posts landed costs and customs entries, and cancels or closes orders short; PURCHASE:ADMIN changes the approval
// limits and customs settings; deleting needs PURCHASE:DELETE. The demo Purchase Manager has all of them.
const PURCHASE_WHO: HelpRole[] = [
  {
    role: "Purchase Manager",
    can: "Everything, including approving requisitions and purchase orders, posting landed costs and customs entries, cancelling or closing orders short, deleting, exporting, and the approval limits and customs settings.",
  },
  {
    role: "Purchase Executive",
    can: "Raise requisitions, RFQs, purchase orders, shipments, goods receipts, returns, customs entries and landed costs. Not approve, post, cancel orders, delete or export.",
  },
];

// Purchase: from the need to the goods in stock, with imports and costs (menu: Purchase).
export const PURCHASE_TOPICS: HelpTopic[] = [
  {
    id: "purchase-requisitions",
    route: "/purchase-service/requisitions",
    module: "Purchase",
    title: "Purchase Requisitions",
    summary: "A request to buy: what is needed, how many and by when. It is submitted, approved, and then becomes a purchase order or an RFQ.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Ask for goods",
        steps: [
          "Click Add Purchase Requisitions.",
          "Choose the Required By Date (today or later).",
          "Leave Requester Employee ID blank to raise it for yourself, or enter the employee it is for.",
          "Add the products and quantities (each product once) and any remarks.",
          "Save. It is a Draft and can still be edited or deleted.",
        ],
      },
      { title: "Submit it", steps: ["Click Submit on the draft. It is now Pending Approval."] },
      { title: "Approve or reject it", steps: ["Click Approve, or Reject with a reason (shown on the requisition)."], who: "Purchase Manager" },
      { title: "Order the goods", steps: ["On an approved requisition click Create Purchase Order: a new order opens with its items.", "Or, to compare vendors first, start a Request for Quotation from the requisition."] },
    ],
    statuses: [
      { name: "Draft", meaning: "Being prepared; can be edited, deleted or cancelled." },
      { name: "Pending Approval", meaning: "Submitted; waiting for a Purchase Manager. Can still be cancelled." },
      { name: "Approved", meaning: "Can be ordered." },
      { name: "Partially ordered / Ordered", meaning: "Purchase orders have been raised for some or all of it." },
      { name: "Rejected", meaning: "Not approved; the reason shows on the requisition." },
      { name: "Cancelled / Closed", meaning: "No longer needed, or finished." },
    ],
    rules: ["The required-by date can't be in the past.", "Only drafts can be edited or deleted (deleting: Purchase Manager)."],
    related: [
      { route: "/purchase-service/orders", label: "Purchase Orders" },
      { route: "/purchase-service/rfqs", label: "Requests for Quotation" },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "purchase-rfqs",
    route: "/purchase-service/rfqs",
    module: "Purchase",
    title: "Requests for Quotation",
    summary: "Ask several vendors for prices, compare their quotes item by item, and award each item to the best vendor: purchase orders are raised for you.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Ask vendors for prices",
        steps: [
          "Click New request; choose a requisition to start from (optional).",
          "Add the products and quantities, the reply-by date and notes to the vendors.",
          "Choose the vendors to ask, and save.",
          "Print it or click Email to vendor (the PDF is attached); or Mark as sent if you sent it another way.",
        ],
      },
      { title: "Enter a vendor's quote", steps: ["Click Enter quote for the vendor.", "Enter the unit price and lead time for each item they quoted; leave the price empty for items they did not quote.", "Or tick Vendor declined. Click Save quote. A quote past its valid-until date shows Expired."] },
      {
        title: "Award and order",
        steps: [
          "Open the request: the Comparison shows every quote, with the best marked.",
          "Click Pick the best prices, or choose the vendor for each item yourself.",
          "Click Award and raise purchase orders: one order per vendor, waiting for approval. The RFQ closes.",
        ],
      },
    ],
    statuses: [
      { name: "Draft", meaning: "Being prepared." },
      { name: "Waiting for quotes", meaning: "Sent to the vendors; enter their quotes as they come." },
      { name: "Awarded", meaning: "Purchase orders raised from it." },
      { name: "Cancelled", meaning: "Closed without an award." },
    ],
    related: [
      { route: "/purchase-service/requisitions", label: "Purchase Requisitions" },
      { route: "/purchase-service/orders", label: "Purchase Orders" },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "purchase-orders",
    route: "/purchase-service/orders",
    module: "Purchase",
    title: "Purchase Orders",
    summary: "Orders to vendors. A purchase order is approved by a Purchase Manager (by amount, under the approval limits), sent to the vendor, and received through goods receipts.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Raise an order",
        steps: [
          "Orders start from an approved requisition: click Create Purchase Order on it and the order form opens with its items. (Awarding an RFQ and Reorder Suggestions also raise orders.)",
          "Choose the vendor; check the order date, expected delivery date, currency, payment terms and shipping address.",
          "Check the products, quantities and prices; tax is added from each product.",
          "Save. The order waits for approval.",
        ],
      },
      {
        title: "Approve it",
        steps: [
          "Set the Approval box to Approved (or Rejected).",
          "Over the second-approval limit, a second person must approve too: until then it shows 1 of 2 approved.",
        ],
        who: "Purchase Manager",
      },
      { title: "Send it to the vendor", steps: ["Print purchase order, or email it, from the row's document actions. An unapproved order prints marked NOT APPROVED."] },
      {
        title: "Stop an order",
        steps: [
          "Nothing received yet: Cancel purchase order. Its requisition can be ordered again.",
          "Part received: Close purchase order short. What wasn't received won't be; what was received stays billable.",
        ],
        who: "Purchase Manager",
      },
    ],
    statuses: [
      { name: "Pending / 1 of 2 approved", meaning: "Waiting for approval; the only time the order can be edited." },
      { name: "Approved", meaning: "Can be sent and received." },
      { name: "Rejected", meaning: "Not approved." },
      { name: "Partially received / Received", meaning: "Some or all of the goods have come in." },
      { name: "Cancelled / Closed", meaning: "Stopped, or closed short." },
    ],
    rules: [
      "Approval is decided only while the order is a draft; changing the order starts the approvals over.",
      "Above the own-approval limit, the buyer who raised an order can't approve it.",
    ],
    related: [
      { route: "/purchase-service/goods-receipt-notes", label: "Goods Receipts (GRN)" },
      { route: "/purchase-service/approval-limits", label: "Approval Limits" },
      { route: "/purchase-service/shipments", label: "Inbound Shipments", why: "For imports." },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "purchase-reorder",
    route: "/purchase-service/reorder",
    module: "Purchase",
    title: "Reorder Suggestions",
    summary: "What to buy now, worked out from what each product really sold, how long vendors really take, and what is already on order. Chosen lines become draft purchase orders.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Order what is running low",
        steps: [
          "Set the chance of not running out and the lead time to use when it is unknown.",
          "Open a row to see how its numbers were reached.",
          "Tick the products to order and check the vendor, quantity and unit price of each.",
          "Click Raise draft purchase orders: one per vendor and currency, waiting for approval as usual.",
        ],
      },
    ],
    fields: [
      { name: "Reorder point", meaning: "Demand over the lead time + safety stock, or the product's reorder level when one is set." },
      { name: "Stock position", meaning: "Available + on order + in draft orders." },
      { name: "Suggested quantity", meaning: "Brings the stock up to the reorder point plus some days of sales." },
    ],
    rules: ["Products that sold nothing in the period get no suggestion."],
    related: [
      { route: "/purchase-service/orders", label: "Purchase Orders" },
      { route: "/inventory", label: "Stock on Hand", why: "Set reorder levels." },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "purchase-shipments",
    route: "/purchase-service/shipments",
    module: "Purchase",
    title: "Inbound Shipments",
    summary: "Imported goods on their way: the containers, the purchase order lines they carry and the dates. When the shipment arrives, receive it in one go.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Record a shipment",
        steps: [
          "Click Book a shipment and choose the vendor: their approved orders with goods still to come are listed.",
          "Tick the order lines on the shipment and the quantities.",
          "Enter the mode, carrier, Incoterm, route, ETD and ETA, and the containers (number, type, seal).",
          "Save.",
        ],
      },
      { title: "Follow it", steps: ["Move the status on as it travels: Departed, Arrived, Cleared by customs (a step can be skipped; it never goes back). Overdue shows when the ETA has passed."] },
      { title: "Declare to customs", steps: ["Click Declare to customs to start the customs declaration for this shipment."] },
      {
        title: "Receive the goods",
        steps: ["Once it has arrived (or been cleared by customs), click Receive now.", "Choose the warehouse and enter what was received and rejected, with batch, expiry and serials where needed.", "One goods receipt is made per purchase order; the goods go into stock straight away."],
      },
      { title: "Add its costs", steps: ["Use Add freight, duty… to put the shipment's charges on its goods as a landed cost."] },
    ],
    statuses: [
      { name: "Booked", meaning: "Planned; what it carries can still change." },
      { name: "In transit", meaning: "The shipment has left; what it carries can't change." },
      { name: "Arrived", meaning: "Ready to receive." },
      { name: "Customs cleared", meaning: "Released by customs; ready to receive." },
      { name: "Fully received", meaning: "Everything on it has been received." },
      { name: "Cancelled", meaning: "Not coming; a reason is asked. Only before anything is received." },
    ],
    rules: ["A container number's last digit is a check digit: a mistyped number is refused."],
    related: [
      { route: "/purchase-service/customs", label: "Customs" },
      { route: "/purchase-service/landed-costs", label: "Landed Costs" },
      { route: "/purchase-service/goods-receipt-notes", label: "Goods Receipts (GRN)" },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "purchase-customs",
    route: "/purchase-service/customs",
    module: "Purchase",
    title: "Customs",
    summary: "Customs declarations for inbound shipments: the customs value, duty and import VAT of each product. Posting adds the duty to the goods' cost and bills the customs authority or clearing agent.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Set up customs (once)",
        steps: [
          "Add the customs authority or your clearing agent as a vendor first.",
          "On the HS tariff & settings tab, under Customs settings: the default duty % (GCC common tariff: 5% on most goods), import VAT % (UAE 5%, Saudi Arabia 15%) and who duty is paid to.",
          "Under Duty by HS code, add rates that differ from the default.",
        ],
        who: "Purchase Manager",
      },
      {
        title: "Declare a shipment",
        steps: [
          "Click New declaration: choose the shipment and enter the customs entry (bill of entry) no.",
          "Enter the customs exchange rate (blank = finance's rate) and freight + insurance to the border (0 when the price already includes them, CIF / CFR).",
          "Save to work out the customs value, duty and import VAT for each product.",
        ],
      },
      {
        title: "Post it",
        steps: ["Post the declaration once the goods are in stock: duty goes into the goods' cost and customs bills the amount payable. It can't be changed afterwards."],
        who: "Purchase Manager",
      },
    ],
    fields: [
      { name: "Customs value", meaning: "The goods at the customs rate + freight, insurance and other costs to the border, spread by value (CIF)." },
      { name: "HS code", meaning: "The tariff code. The most specific code wins: a rate for 8544 covers 8544.42.00 unless that has its own." },
    ],
    statuses: [
      { name: "Draft", meaning: "Can be changed or deleted." },
      { name: "Posted", meaning: "In the cost and billed; final." },
    ],
    related: [
      { route: "/purchase-service/shipments", label: "Inbound Shipments" },
      { route: "/purchase-service/landed-costs", label: "Landed Costs" },
    ],
  },
  {
    id: "goods-receipt-notes",
    route: "/purchase-service/goods-receipt-notes",
    module: "Purchase",
    title: "Goods Receipts (GRN)",
    summary: "Record goods that arrived against a purchase order. Accepted goods go into stock as soon as the receipt is saved, and finance can bill them.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Receive goods",
        steps: [
          "Click Add Goods Receipt Notes and select the purchase order (only approved orders still waiting for goods).",
          "Choose the warehouse and the receipt date.",
          "For each line enter the received, accepted and rejected quantities.",
          "Enter the batch, manufacturing and expiry dates, and one serial number per accepted unit where the product tracks them.",
          "Save: the accepted goods go into stock.",
        ],
      },
      { title: "Receive the rest later", steps: ["Click Receive Pending Goods on a receipt to make a new receipt for what is still to come."] },
      { title: "When the stock didn't post", steps: ["If Stock shows Not posted (Inventory was unreachable), click Retry posting to Inventory."] },
    ],
    fields: [
      { name: "Accepted / Received", meaning: "Accepted goods go into stock; rejected ones don't." },
      { name: "Stock", meaning: "In stock, Waiting or Not posted (hover to see why)." },
    ],
    rules: [
      "A receipt can be cancelled (Purchase Manager) only while its goods aren't in stock.",
      "Goods go only into active warehouses (not a vendor's consignment location).",
    ],
    related: [
      { route: "/purchase-service/orders", label: "Purchase Orders" },
      { route: "/purchaseInvoices", label: "Purchase Invoices", why: "Bill the receipt." },
      { route: "/purchase-service/returns", label: "Purchase Returns" },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "purchase-returns",
    route: "/purchase-service/returns",
    module: "Purchase",
    title: "Purchase Returns",
    summary: "Send goods back to a vendor. The vendor either credits you (a debit note reduces their bill) or sends replacement goods.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Return goods",
        steps: [
          "Click New Return and choose the goods receipt the items came in on.",
          "Enter the return quantity for each item (up to what can still be returned), the reason and the return date.",
          "Choose Settled by: a debit note, or Replacement (vendor sends the goods again).",
          "Save. It is a draft: nothing leaves stock until you send it back.",
        ],
      },
      { title: "Send it back", steps: ["Click Send back to vendor on the draft when the goods leave: they are taken out of stock, and for a debit note finance records it against the vendor."] },
      { title: "Receive the replacement", steps: ["When the vendor's goods arrive, click Receive replacement: they go into stock."] },
    ],
    statuses: [
      { name: "Draft", meaning: "Saved; nothing has left stock. Cancel draft removes it (Purchase Manager)." },
      { name: "Sent back", meaning: "The goods have left; settled by a debit note." },
      { name: "Awaiting replacement", meaning: "The goods have left; waiting for the vendor's replacement." },
      { name: "Replaced", meaning: "The replacement has arrived." },
      { name: "Cancelled", meaning: "Not going back." },
    ],
    rules: [
      "Returns are raised against a goods receipt whose goods are in stock.",
      "If the debit note couldn't be recorded, the return says so (Debit notes not recorded).",
    ],
    related: [
      { route: "/purchase-service/goods-receipt-notes", label: "Goods Receipts (GRN)" },
      { route: "/accountsPayable", label: "Accounts Payable" },
    ],
  },
  {
    id: "purchase-landed-costs",
    route: "/purchase-service/landed-costs",
    module: "Purchase",
    title: "Landed Costs",
    summary: "Put freight, duty, insurance and other costs of bringing goods in onto the goods receipts they belong to, so the stock carries its true cost.",
    who: PURCHASE_WHO,
    tasks: [
      {
        title: "Add a landed cost",
        steps: [
          "Click New landed cost and enter a reference (e.g. the container number).",
          "Choose the goods receipts it covers (for a shipment, only its receipts).",
          "Add the charges: type, description, amount without tax, tax, and who billed it with their bill no. and date.",
          "Choose how to spread it over the goods, check the share per product, and save as a draft.",
        ],
      },
      {
        title: "Post it",
        steps: ["Click Post: the items' average cost goes up, the charges are booked as accrued landed costs, and a bill is made in finance for each charge with a vendor and bill number. It can't be changed afterwards."],
        who: "Purchase Manager",
      },
    ],
    fields: [
      { name: "Added to stock value", meaning: "The part of the cost on goods still in stock." },
      { name: "To cost of sales", meaning: "The part on goods already sold." },
    ],
    rules: ["Amounts are without tax: tax is reclaimed, so it doesn't go on the stock."],
    related: [
      { route: "/purchase-service/shipments", label: "Inbound Shipments" },
      { route: "/purchase-service/customs", label: "Customs" },
    ],
  },
  {
    id: "purchase-approval-limits",
    route: "/purchase-service/approval-limits",
    module: "Purchase",
    title: "Approval Limits",
    summary: "Who may approve purchase orders, by amount: when the buyer can't approve their own order, and when two people must approve.",
    who: [
      { role: "Purchase Manager", can: "Change the limits (needs the Purchase admin right)." },
      { role: "Others with Purchase access", can: "See the limits." },
    ],
    tasks: [{ title: "Set the limits", steps: ["Enter the own-approval limit and the second-approval limit (or leave empty for no limit).", "Click Save limits."] }],
    fields: [
      { name: "Own-approval limit", meaning: "Above this, the buyer who raised an order can't approve it themselves." },
      { name: "Second-approval limit", meaning: "Above this, two different people (neither the buyer) must approve." },
    ],
    rules: ["Orders are measured by their total in the company's currency, at the rate on the order date.", "Empty = no limit: anyone allowed to approve purchase orders approves any order."],
    related: [{ route: "/purchase-service/orders", label: "Purchase Orders" }],
  },
];
