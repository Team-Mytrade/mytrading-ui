import type { HelpFlow } from "./types";

// The user manual: end-to-end business flows across pages. More flows are added with their modules (backlog 8.1).
export const HELP_FLOWS: HelpFlow[] = [
  {
    id: "lead-to-order",
    title: "From a lead to a sales order",
    summary: "Win new business: capture the lead, qualify it, make it a customer, quote and turn the accepted quotation into an order.",
    steps: [
      { title: "Capture the lead", route: "/leads", who: "CRM Executive", detail: "Add the lead with name, email and phone; status New." },
      { title: "Follow up", route: "/activities", who: "CRM Executive", detail: "Plan calls and meetings; record what was said under Interactions. Move the lead to Contacted, then Qualified." },
      { title: "Open a deal", route: "/opportunities", who: "CRM Executive", detail: "Record what they want (products, quantities) and the expected close date." },
      { title: "Make them a customer", route: "/leads", who: "CRM Executive", detail: "Convert to Customer (or link to an existing customer)." },
      { title: "Quote", route: "/quotations", who: "Sales Executive", detail: "Create the quotation from the deal (lines filled in) and send it to the customer." },
      { title: "Accept and convert", route: "/quotations", who: "Sales Manager", detail: "When the customer agrees, accept the quotation and convert it to a sales order." },
    ],
  },
  {
    id: "order-to-cash",
    title: "From a sales order to cash",
    summary: "Deliver and get paid: confirm the order, dispatch the goods, invoice and collect.",
    steps: [
      { title: "Confirm the order", route: "/sales-orders", who: "Sales Manager", detail: "Confirm the sales order and choose the warehouse; the stock is reserved." },
      { title: "Dispatch", route: "/sales-orders", who: "Sales Executive / Manager", detail: "Create the dispatch; the manager confirms it and the stock goes out." },
      { title: "Invoice", route: "/invoices", who: "Finance Executive / Manager", detail: "Create the invoice from the dispatch; the manager issues it (numbered, posted, e-invoiced where required)." },
      { title: "Collect", route: "/paymentReceipts", who: "Finance Executive", detail: "Record the customer's payment and allocate it to the invoice." },
    ],
  },
  {
    id: "delivery-run",
    title: "Delivering a sales order with your own vehicles",
    summary: "Plan the delivery, hand over the goods with a challan, follow the vehicle and confirm what the customer received, which takes the goods out of stock.",
    steps: [
      { title: "Plan the delivery", route: "/deliveryOrder", who: "Delivery Executive", detail: "Add a delivery order for the confirmed sales order: Load lines, then choose the warehouse, address, vehicle and transporter. A draft sales dispatch holds the quantities." },
      { title: "Make the delivery note", route: "/delivery-note", who: "Delivery Executive", detail: "Add the delivery note from the delivery order and print the delivery challan for the driver." },
      { title: "Drive", route: "/driver", who: "Driver", detail: "In Driver Mode, start the trip on the vehicle, tap Start delivery and, at the customer, Delivered, Partly or Not delivered." },
      { title: "Follow it", route: "/vehicle-tracking", who: "Delivery Executive", detail: "Watch the vehicle on Live Tracking and the updates on Delivery Status." },
      { title: "Confirm the delivery", route: "/delivery-note", who: "Delivery Executive", detail: "Enter the delivered quantities from the signed challan and click Confirm delivery (stock out): the sales dispatch is confirmed and the stock goes out." },
      { title: "Invoice", route: "/invoices", who: "Finance Executive / Manager", detail: "Create the invoice from the confirmed dispatch." },
    ],
  },
  {
    id: "procure-to-pay",
    title: "From a purchase need to paying the vendor",
    summary: "Buy what you need: request, approve, order, receive, bill and pay.",
    steps: [
      { title: "Request", route: "/purchase-service/requisitions", who: "Purchase Executive", detail: "Raise a purchase requisition and submit it." },
      { title: "Approve", route: "/purchase-service/requisitions", who: "Purchase Manager", detail: "Approve the requisition." },
      { title: "Order", route: "/purchase-service/orders", who: "Purchase Executive / Manager", detail: "Click Create Purchase Order on the approved requisition (or award an RFQ) and choose the vendor; the manager approves the order." },
      { title: "Receive", route: "/purchase-service/goods-receipt-notes", who: "Purchase Executive", detail: "Record the goods receipt; stock goes up." },
      { title: "Bill", route: "/purchaseInvoices", who: "Finance Executive", detail: "Make the bill from the goods receipt with the vendor's invoice number." },
      { title: "Pay", route: "/vendorPayments", who: "Finance Executive", detail: "Pay the vendor against the bill." },
    ],
  },
  {
    id: "month-end",
    title: "Closing the month",
    summary: "Get the month's books right, then lock them: bank, cheques, depreciation, commission, foreign currency, statements and VAT.",
    steps: [
      { title: "Reconcile the bank", route: "/bankAccounts", who: "Finance Executive", detail: "Import each account's statement, match it and post the bank charges and interest that aren't in the books yet." },
      { title: "Clear the cheques", route: "/cheques", who: "Finance Executive", detail: "Mark the cheques the bank paid as Cleared; the Finance Manager marks bounced ones." },
      { title: "Depreciate", route: "/fixedAssets", who: "Finance Manager", detail: "Run depreciation up to the month." },
      { title: "Approve commission", route: "/salesCommission", who: "Finance Manager", detail: "Approve the month's statements, then pay them or send them to payroll." },
      { title: "Revalue foreign currency", route: "/postingAccounts", who: "Finance Manager", detail: "Post the month-end exchange revaluation at the last day of the month (rates on Exchange Rates)." },
      { title: "Check the statements", route: "/financialStatements", who: "Finance Manager", detail: "Read the profit and loss and balance sheet for the month; the trial balance must balance." },
      { title: "File VAT and lock", route: "/postingAccounts", who: "Finance Manager", detail: "Once the VAT return is filed, lock the books up to the month's end." },
    ],
  },
  {
    id: "hire-to-pay",
    title: "From hiring to the first payslip",
    summary: "Bring someone on board and pay them.",
    steps: [
      { title: "Add the employee", route: "/employeeRecords", who: "HR & Payroll Executive", detail: "Add the employee with department, line manager and role; their login is created." },
      { title: "Set the pay", route: "/salaryStructure", who: "HR & Payroll Executive", detail: "Add the salary structure: yearly basic, HRA and other allowances." },
      { title: "Set up attendance", route: "/att_shiftSchedule", who: "Attendance Manager", detail: "Assign their shift, attendance policy and leave policy, so their punches and leave count." },
      { title: "Run payroll", route: "/payrollEngine", who: "HR & Payroll Manager", detail: "Upload the month's attendance and one-off amounts, run the payroll, post it to the ledger and record the salary payment." },
      { title: "Payslips", route: "/employeePayslips", who: "HR & Payroll Manager", detail: "The run makes the payslips; each employee sees their own on Payslips." },
    ],
  },
  {
    id: "pos-day",
    title: "A day at the counter",
    summary: "Run a till for a day: open the shift, sell, take returns and close with a cash count.",
    steps: [
      { title: "Set up the till (once)", route: "/sales-pos", who: "Sales Manager", detail: "Till settings: the warehouse it sells from, the walk-in customer and where cash and card go." },
      { title: "Open the shift", route: "/sales-pos", who: "Cashier", detail: "Choose the till and enter the cash in the till at the start." },
      { title: "Sell", route: "/sales-pos", who: "Cashier", detail: "Scan or search the items and take cash or card; each sale becomes a tax invoice. Retry any invoice shown as pending." },
      { title: "Returns", route: "/sales-pos", who: "Supervisor", detail: "Find the sale by receipt or invoice number, enter what comes back and refund by cash or card." },
      { title: "Close the shift", route: "/sales-pos", who: "Cashier", detail: "Count the cash; any difference is posted to the ledger." },
    ],
  },
  {
    id: "sales-returns",
    title: "When a customer sends goods back",
    summary: "Record the return, decide on it, then refund or exchange.",
    steps: [
      { title: "Record the return", route: "/return-requests", who: "Sales Executive", detail: "Choose the delivered order and item, the quantity, the reason, and refund or exchange." },
      { title: "Approve or reject", route: "/return-requests", who: "Sales Manager", detail: "Set the return Approved or Rejected." },
      { title: "Refund", route: "/refunds", who: "Sales Executive", detail: "Refund the approved return and mark it Processed when paid; finance raises the credit note." },
      { title: "Or exchange", route: "/return-requests", who: "Sales Executive", detail: "Complete an approved exchange: the same items go out again and the returned ones come back into stock." },
    ],
  },
];
