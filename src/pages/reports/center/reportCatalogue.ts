/**
 * Every business report in one list (backlog 8.2): the Report Center's own reports and the module reports that already
 * exist elsewhere, each under its module. Reports → All reports lists them all; Reports → Sales, Purchase, … each open
 * one module's reports (/reports/<module>). Only the ones the user can open are shown (canAccessPath).
 */
export type ReportModule = "sales" | "purchase" | "inventory" | "finance" | "hr";

export interface ReportEntry {
  path: string;
  title: string;
  description: string;
  module: ReportModule;
  /** A report built in the Report Center (shared filters and export), not a module page. */
  center?: boolean;
}

/** The modules in menu order; title is the menu label and page heading, path the module's report page. */
export const REPORT_MODULES: { module: ReportModule; title: string; path: string; description: string }[] = [
  { module: "sales", title: "Sales", path: "/reports/sales", description: "What you sold, to whom, who sold it and what it earned" },
  { module: "purchase", title: "Purchase", path: "/reports/purchase", description: "What you bought, from whom, and what is still to come or to bill" },
  { module: "inventory", title: "Inventory", path: "/reports/inventory", description: "What you hold, how old it is and what moves" },
  { module: "finance", title: "Finance", path: "/reports/finance", description: "Books, ledgers, statements, tax and cash" },
  { module: "hr", title: "HR & Payroll", path: "/reports/hr", description: "People, pay, leave and attendance" },
];

export const reportModuleFor = (pathname: string) => REPORT_MODULES.find((m) => m.path === pathname);

/** Every report of a module (the caller keeps the ones the user may open). */
export const reportsOfModule = (module: ReportModule) => REPORTS.filter((r) => r.module === module);

export const REPORTS: ReportEntry[] = [
  // Sales
  {
    path: "/reports/sales-register",
    title: "Sales Register",
    description: "Every issued invoice and credit note in the period, with net, tax and total.",
    module: "sales",
    center: true,
  },
  {
    path: "/reports/sales-analysis",
    title: "Sales Analysis",
    description: "Net sales by customer, product, category, sales person or month, after credit notes.",
    module: "sales",
    center: true,
  },
  {
    path: "/reports/open-orders",
    title: "Open Orders",
    description: "Confirmed orders with lines still to deliver: their value, how late they are, and by product.",
    module: "sales",
    center: true,
  },
  {
    path: "/reports/dispatched-not-invoiced",
    title: "Dispatched Not Invoiced",
    description: "Goods and services that went out but no issued invoice bills yet, oldest first.",
    module: "sales",
    center: true,
  },
  {
    path: "/reports/quotation-conversion",
    title: "Quotation Conversion",
    description: "How many quotations became orders, by sales person, customer or month.",
    module: "sales",
    center: true,
  },
  {
    path: "/reports/returns-refunds",
    title: "Returns & Refunds",
    description: "Goods returned, why, and what was refunded or is still to refund.",
    module: "sales",
    center: true,
  },
  {
    path: "/reports/gross-margin",
    title: "Gross Margin",
    description: "Net sales less what the goods cost, by product, customer, category, sales person or month.",
    module: "sales",
    center: true,
  },
  { path: "/sales-dashboard", title: "Sales Dashboard", description: "Orders, dispatches and the pipeline at a glance.", module: "sales" },
  { path: "/crm-reports", title: "CRM Reports", description: "Leads, opportunities, won and lost deals and activities.", module: "sales" },
  { path: "/salesCommission", title: "Sales Commission", description: "Commission earned by each sales person, month by month.", module: "sales" },

  // Purchase
  {
    path: "/reports/purchase-register",
    title: "Purchase Register",
    description: "Every vendor bill and debit note in the period, with net, tax and total.",
    module: "purchase",
    center: true,
  },
  {
    path: "/reports/purchase-analysis",
    title: "Purchase Analysis",
    description: "Goods received less goods sent back, by vendor, product or month.",
    module: "purchase",
    center: true,
  },
  {
    path: "/reports/open-purchase-orders",
    title: "Open Purchase Orders",
    description: "Orders with goods still to receive: their value, how late they are, and by product.",
    module: "purchase",
    center: true,
  },
  {
    path: "/reports/received-not-billed",
    title: "Goods Received Not Billed",
    description: "Goods accepted into stock that no vendor bill covers yet, oldest first.",
    module: "purchase",
    center: true,
  },
  {
    path: "/reports/vendor-performance",
    title: "Vendor Performance",
    description: "Each vendor's on-time deliveries, rejections, returns and prices against other vendors.",
    module: "purchase",
    center: true,
  },
  { path: "/accountsPayable", title: "Accounts Payable", description: "Vendor bills still to pay, with their age.", module: "purchase" },

  // Finance
  {
    path: "/reports/day-book",
    title: "Day Book",
    description: "Every journal entry of the period with its debits and credits.",
    module: "finance",
    center: true,
  },
  {
    path: "/reports/cash-bank-book",
    title: "Cash & Bank Book",
    description: "One cash box's or bank account's money in and out, with the balance after each.",
    module: "finance",
    center: true,
  },
  {
    path: "/reports/receipts-payments",
    title: "Receipts & Payments",
    description: "Money in and out of every cash box and bank account, by what it was for.",
    module: "finance",
    center: true,
  },
  {
    path: "/reports/customer-ledger",
    title: "Customer Ledger",
    description: "A customer's invoices, credit notes and payments with the running balance.",
    module: "finance",
    center: true,
  },
  {
    path: "/reports/vendor-ledger",
    title: "Vendor Ledger",
    description: "A vendor's bills, debit notes, payments and advances with the running balance.",
    module: "finance",
    center: true,
  },
  {
    path: "/reports/expenses",
    title: "Expenses by Account",
    description: "What each expense account took, by cost centre or month.",
    module: "finance",
    center: true,
  },
  { path: "/accountsReceivable", title: "Accounts Receivable", description: "What customers owe, with their age.", module: "finance" },
  { path: "/generalLedger", title: "General Ledger", description: "Every posting by account.", module: "finance" },
  { path: "/financialStatements", title: "Financial Statements", description: "Trial balance, profit and loss and balance sheet.", module: "finance" },
  { path: "/vatReturn", title: "VAT Return", description: "The figures for your VAT return, box by box.", module: "finance" },
  { path: "/cashFlowForecast", title: "Cash Flow Forecast", description: "Expected money in and out over the coming weeks.", module: "finance" },
  { path: "/budgets", title: "Budgets", description: "Budget against actual by account.", module: "finance" },

  // HR & payroll, and stock (Inventory)
  {
    path: "/reports/headcount",
    title: "Headcount",
    description: "Headcount, joiners and leavers by department and month, with turnover.",
    module: "hr",
    center: true,
  },
  {
    path: "/reports/payroll-register",
    title: "Payroll Register",
    description: "What each employee was paid, month by month, from approved payroll runs.",
    module: "hr",
    center: true,
  },
  {
    path: "/reports/leave-balances",
    title: "Leave Balances",
    description: "Every employee's leave by type for a leave year: entitled, taken and left.",
    module: "hr",
    center: true,
  },
  {
    path: "/reports/stock-aging",
    title: "Stock Aging",
    description: "Stock on hand by how long it has been in, at average cost.",
    module: "inventory",
    center: true,
  },
  {
    path: "/reports/abc-analysis",
    title: "ABC Analysis",
    description: "Products ranked A, B and C by what their sales cost, with the stock held.",
    module: "inventory",
    center: true,
  },
  { path: "/inventory-report", title: "Inventory Report", description: "Stock, valuation, movements, cost of goods sold and slow stock.", module: "inventory" },
  { path: "/payrollSummary", title: "Payroll Summary", description: "Pay, deductions and net pay by month.", module: "hr" },
  { path: "/departmentSummary", title: "Department Summary", description: "Payroll cost by department.", module: "hr" },
  { path: "/departmentSalary", title: "Department Salary", description: "Salary cost by department for a month or the year to date.", module: "hr" },
  { path: "/att_reports", title: "Attendance Reports", description: "Attendance, lateness and leave by employee.", module: "hr" },
];
