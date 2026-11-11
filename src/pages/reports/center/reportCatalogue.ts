/**
 * Every business report in one list (backlog 8.2): the Report Center's own reports and the module reports that already
 * exist elsewhere. The Report Center shows only the ones the user can open (canAccessPath).
 */
export type ReportFamily = "Sales" | "Purchase & payables" | "Finance books" | "HR & stock";

export interface ReportEntry {
  path: string;
  title: string;
  description: string;
  family: ReportFamily;
  /** A report built in the Report Center (shared filters and export), not a module page. */
  center?: boolean;
}

export const REPORT_FAMILIES: { family: ReportFamily; description: string }[] = [
  { family: "Sales", description: "What you sold, to whom and who sold it" },
  { family: "Purchase & payables", description: "What you bought and what you owe" },
  { family: "Finance books", description: "Ledgers, statements, tax and cash" },
  { family: "HR & stock", description: "People, pay, attendance and stock" },
];

export const REPORTS: ReportEntry[] = [
  // Sales
  {
    path: "/reports/sales-register",
    title: "Sales Register",
    description: "Every issued invoice and credit note in the period, with net, tax and total.",
    family: "Sales",
    center: true,
  },
  {
    path: "/reports/sales-analysis",
    title: "Sales Analysis",
    description: "Net sales by customer, product, category, sales person or month, after credit notes.",
    family: "Sales",
    center: true,
  },
  {
    path: "/reports/open-orders",
    title: "Open Orders",
    description: "Confirmed orders with lines still to deliver: their value, how late they are, and by product.",
    family: "Sales",
    center: true,
  },
  {
    path: "/reports/dispatched-not-invoiced",
    title: "Dispatched Not Invoiced",
    description: "Goods and services that went out but no issued invoice bills yet, oldest first.",
    family: "Sales",
    center: true,
  },
  {
    path: "/reports/quotation-conversion",
    title: "Quotation Conversion",
    description: "How many quotations became orders, by sales person, customer or month.",
    family: "Sales",
    center: true,
  },
  {
    path: "/reports/returns-refunds",
    title: "Returns & Refunds",
    description: "Goods returned, why, and what was refunded or is still to refund.",
    family: "Sales",
    center: true,
  },
  {
    path: "/reports/gross-margin",
    title: "Gross Margin",
    description: "Net sales less what the goods cost, by product, customer, category, sales person or month.",
    family: "Sales",
    center: true,
  },
  { path: "/sales-dashboard", title: "Sales Dashboard", description: "Orders, dispatches and the pipeline at a glance.", family: "Sales" },
  { path: "/crm-reports", title: "CRM Reports", description: "Leads, opportunities, won and lost deals and activities.", family: "Sales" },
  { path: "/salesCommission", title: "Sales Commission", description: "Commission earned by each sales person, month by month.", family: "Sales" },

  // Purchase & payables
  {
    path: "/reports/purchase-register",
    title: "Purchase Register",
    description: "Every vendor bill and debit note in the period, with net, tax and total.",
    family: "Purchase & payables",
    center: true,
  },
  {
    path: "/reports/purchase-analysis",
    title: "Purchase Analysis",
    description: "Goods received less goods sent back, by vendor, product or month.",
    family: "Purchase & payables",
    center: true,
  },
  {
    path: "/reports/open-purchase-orders",
    title: "Open Purchase Orders",
    description: "Orders with goods still to receive: their value, how late they are, and by product.",
    family: "Purchase & payables",
    center: true,
  },
  {
    path: "/reports/received-not-billed",
    title: "Goods Received Not Billed",
    description: "Goods accepted into stock that no vendor bill covers yet, oldest first.",
    family: "Purchase & payables",
    center: true,
  },
  {
    path: "/reports/vendor-performance",
    title: "Vendor Performance",
    description: "Each vendor's on-time deliveries, rejections, returns and prices against other vendors.",
    family: "Purchase & payables",
    center: true,
  },
  { path: "/purchase-reports", title: "Purchase Reports", description: "Spend by vendor and month, and how long orders took to arrive.", family: "Purchase & payables" },
  { path: "/accountsPayable", title: "Accounts Payable", description: "Vendor bills still to pay, with their age.", family: "Purchase & payables" },

  // Finance books
  {
    path: "/reports/day-book",
    title: "Day Book",
    description: "Every journal entry of the period with its debits and credits.",
    family: "Finance books",
    center: true,
  },
  {
    path: "/reports/cash-bank-book",
    title: "Cash & Bank Book",
    description: "One cash box's or bank account's money in and out, with the balance after each.",
    family: "Finance books",
    center: true,
  },
  {
    path: "/reports/receipts-payments",
    title: "Receipts & Payments",
    description: "Money in and out of every cash box and bank account, by what it was for.",
    family: "Finance books",
    center: true,
  },
  {
    path: "/reports/customer-ledger",
    title: "Customer Ledger",
    description: "A customer's invoices, credit notes and payments with the running balance.",
    family: "Finance books",
    center: true,
  },
  {
    path: "/reports/vendor-ledger",
    title: "Vendor Ledger",
    description: "A vendor's bills, debit notes, payments and advances with the running balance.",
    family: "Finance books",
    center: true,
  },
  {
    path: "/reports/expenses",
    title: "Expenses by Account",
    description: "What each expense account took, by cost centre or month.",
    family: "Finance books",
    center: true,
  },
  { path: "/financeReport", title: "Finance Report", description: "Invoiced, collected, outstanding and overdue.", family: "Finance books" },
  { path: "/accountsReceivable", title: "Accounts Receivable", description: "What customers owe, with their age.", family: "Finance books" },
  { path: "/generalLedger", title: "General Ledger", description: "Every posting by account.", family: "Finance books" },
  { path: "/financialStatements", title: "Financial Statements", description: "Trial balance, profit and loss and balance sheet.", family: "Finance books" },
  { path: "/taxReport", title: "Tax Report", description: "Tax charged on sales, month by month.", family: "Finance books" },
  { path: "/vatReturn", title: "VAT Return", description: "The figures for your VAT return, box by box.", family: "Finance books" },
  { path: "/cashFlowForecast", title: "Cash Flow Forecast", description: "Expected money in and out over the coming weeks.", family: "Finance books" },
  { path: "/budgets", title: "Budgets", description: "Budget against actual by account.", family: "Finance books" },

  // HR & stock
  {
    path: "/reports/headcount",
    title: "Headcount",
    description: "Headcount, joiners and leavers by department and month, with turnover.",
    family: "HR & stock",
    center: true,
  },
  {
    path: "/reports/payroll-register",
    title: "Payroll Register",
    description: "What each employee was paid, month by month, from approved payroll runs.",
    family: "HR & stock",
    center: true,
  },
  {
    path: "/reports/leave-balances",
    title: "Leave Balances",
    description: "Every employee's leave by type for a leave year: entitled, taken and left.",
    family: "HR & stock",
    center: true,
  },
  {
    path: "/reports/stock-aging",
    title: "Stock Aging",
    description: "Stock on hand by how long it has been in, at average cost.",
    family: "HR & stock",
    center: true,
  },
  {
    path: "/reports/abc-analysis",
    title: "ABC Analysis",
    description: "Products ranked A, B and C by what their sales cost, with the stock held.",
    family: "HR & stock",
    center: true,
  },
  { path: "/inventory-report", title: "Inventory Report", description: "Stock, valuation, movements, cost of goods sold and slow stock.", family: "HR & stock" },
  { path: "/payrollSummary", title: "Payroll Summary", description: "Pay, deductions and net pay by month.", family: "HR & stock" },
  { path: "/departmentSummary", title: "Department Summary", description: "Payroll cost by department.", family: "HR & stock" },
  { path: "/departmentSalary", title: "Department Salary", description: "Salary cost by department for a month or the year to date.", family: "HR & stock" },
  { path: "/att_reports", title: "Attendance Reports", description: "Attendance, lateness and leave by employee.", family: "HR & stock" },
];
