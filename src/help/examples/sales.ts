import type { HelpExample } from "../types";

// Examples for Sales (topics/sales.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data). One case runs
// through several pages: 10 ThinkPads for Emirates IT Mart, AED 36,990 + 5% VAT = AED 38,839.50.
export const SALES_EXAMPLES: Record<string, HelpExample> = {
  "sales-dashboard": {
    story: "Ahmed checks the sales dashboard on the last week of November.",
    data: [
      { label: "Sales this month", value: "AED 412,580 (target AED 450,000)" },
      { label: "Open quotations", value: "6 · AED 221,400" },
      { label: "Orders to dispatch", value: "4" },
      { label: "Top product", value: "Lenovo ThinkPad E14 i5/16GB" },
    ],
    result: "92% of target with a week to go; he opens the 6 quotations to chase them.",
  },
  quotations: {
    story: "Emirates IT Mart asks for a price on 10 ThinkPads; Rahul prepares the quotation.",
    data: [
      { label: "Quotation", value: "QT-2026-0042" },
      { label: "Customer", value: "Emirates IT Mart" },
      { label: "Line", value: "10 × Lenovo ThinkPad E14 i5/16GB @ AED 3,699" },
      { label: "Subtotal", value: "AED 36,990.00" },
      { label: "VAT 5%", value: "AED 1,849.50" },
      { label: "Total", value: "AED 38,839.50" },
      { label: "Valid until", value: "30 Nov 2026" },
    ],
    result: "Rahul emails the PDF; when the customer accepts, he converts it into a sales order in one click.",
  },
  "sales-orders": {
    story: "The accepted quotation becomes an order; Ahmed confirms it and the warehouse dispatches.",
    data: [
      { label: "Order", value: "SO-2026-0117 (from QT-2026-0042)" },
      { label: "Customer", value: "Emirates IT Mart" },
      { label: "Line", value: "10 × Lenovo ThinkPad E14 i5/16GB" },
      { label: "Warehouse", value: "Jebel Ali Main Warehouse" },
      { label: "Total", value: "AED 38,839.50" },
      { label: "Status", value: "Confirmed → Dispatched" },
    ],
    result: "Confirming reserves 10 laptops; dispatching takes them out of stock and the order is ready to invoice.",
  },
  "sales-pos": {
    company: "GET",
    story: "A walk-in customer at the Deira showroom buys a phone and a charger.",
    data: [
      { label: "Till", value: "Deira Showroom – Till 1 (shift opened with AED 500 float)" },
      { label: "Items", value: "Samsung Galaxy A55 128GB 1,399 · Anker 65W USB-C Charger 159" },
      { label: "VAT 5%", value: "AED 77.90" },
      { label: "Total", value: "AED 1,635.90" },
      { label: "Paid", value: "Cash 1,700 · change 64.10" },
    ],
    result: "A tax invoice prints at once and both items leave the Deira Showroom Store stock.",
  },
  "sales-online-stores": {
    story: "The company sells on its Shopify store and on noon.",
    data: [
      { label: "Store", value: "gulf-electronics.myshopify.com" },
      { label: "Linked product", value: "SKU GE-JBL-FLIP6 → JBL Flip 6 Speaker" },
      { label: "Order received", value: "#1042 · 2 × JBL Flip 6 · AED 942.90" },
    ],
    result: "Order #1042 arrives as a sales order; the noon payout is later matched to its invoices.",
  },
  "sales-price-lists": {
    story: "Retail shops get a better price on accessories than walk-in customers.",
    data: [
      { label: "Price list", value: "Retail partners 2026" },
      { label: "Logitech MX Master 3S Mouse", value: "AED 349 (standard 379)" },
      { label: "JBL Flip 6 Speaker", value: "AED 419 (standard 449)" },
      { label: "Customers", value: "Al Noor Electronics Retail, Creek Side Computers" },
    ],
    result: "When Al Noor is picked on a quotation, the mouse fills in at AED 349.",
  },
  "credit-limit": {
    story: "Emirates IT Mart places another order before paying the last invoice.",
    data: [
      { label: "Credit limit", value: "AED 60,000" },
      { label: "Outstanding", value: "AED 38,839.50" },
      { label: "New order", value: "SO-2026-0124 · AED 25,000" },
      { label: "Would reach", value: "AED 63,839.50 (over by 3,839.50)" },
    ],
    result: "The order goes on credit hold until a manager releases it or the customer pays.",
  },
  "return-requests": {
    story: "Al Noor Electronics Retail returns two speakers that won't charge.",
    data: [
      { label: "Return", value: "RR-2026-0009" },
      { label: "Invoice", value: "INV-2026-00305" },
      { label: "Item", value: "2 × JBL Flip 6 Speaker" },
      { label: "Reason", value: "Defective – not charging" },
      { label: "Refund", value: "AED 942.90 (898 + VAT 44.90)" },
    ],
    result: "Once approved, the speakers come back into stock as returned and a refund is raised.",
  },
  refunds: {
    story: "Finance pays back Al Noor for the returned speakers.",
    data: [
      { label: "Refund", value: "RF-2026-0006 (from RR-2026-0009)" },
      { label: "Amount", value: "AED 942.90" },
      { label: "Paid by", value: "Bank transfer · Emirates NBD" },
    ],
    result: "Marking it paid reduces Al Noor's balance and posts to the bank account.",
  },
  "service-schedules": {
    story: "Smart Office Solutions books an on-site setup of 20 new laptops.",
    data: [
      { label: "Customer", value: "Smart Office Solutions FZE" },
      { label: "Visit", value: "20 Nov 2026, 10:00 – 14:00" },
      { label: "Technician", value: "Khalid Rahman" },
      { label: "Job", value: "Set up 20 × HP ProBook 450 G10" },
    ],
    result: "Khalid sees the visit on his schedule; he marks it completed after setup.",
  },
  "service-schedule-notify": {
    story: "A reminder goes out the day before the setup visit.",
    data: [
      { label: "Visit", value: "Smart Office Solutions · 20 Nov 2026" },
      { label: "Remind", value: "1 day before, 09:00" },
      { label: "Send to", value: "Khalid Rahman, lina.haddad@smartoffice.test" },
    ],
    result: "Both the technician and the customer get an email on 19 November.",
  },
  "sales-persons": {
    story: "A new salesman joins and is added so orders can be credited to him.",
    data: [
      { label: "Name", value: "Omar Haddad" },
      { label: "Employee", value: "EMP-0058" },
      { label: "Commission", value: "2% of collected sales" },
    ],
    result: "Orders with Omar as sales person count towards his target and commission.",
  },
  "sales-channels": {
    story: "Sales tracks where orders come from.",
    data: [
      { label: "Channels", value: "Showroom, Field sales, Shopify, noon" },
      { label: "Order SO-2026-0117", value: "Field sales" },
    ],
    result: "Sales Analysis can split November's sales by channel.",
  },
  "sales-targets": {
    story: "Ahmed sets Rahul's target for the quarter.",
    data: [
      { label: "Sales person", value: "Rahul Menon" },
      { label: "Period", value: "Oct – Dec 2026" },
      { label: "Target", value: "AED 450,000" },
      { label: "Achieved", value: "AED 301,250 (67%)" },
    ],
    result: "Rahul's progress updates as his orders are confirmed.",
  },
};
