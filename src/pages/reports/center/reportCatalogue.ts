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
  { path: "/sales-dashboard", title: "Sales Dashboard", description: "Orders, dispatches and the pipeline at a glance.", family: "Sales" },
  { path: "/crm-reports", title: "CRM Reports", description: "Leads, opportunities, won and lost deals and activities.", family: "Sales" },
  { path: "/salesCommission", title: "Sales Commission", description: "Commission earned by each sales person, month by month.", family: "Sales" },

  // Purchase & payables
  { path: "/purchase-reports", title: "Purchase Reports", description: "Spend by vendor and month, and how long orders took to arrive.", family: "Purchase & payables" },
  { path: "/accountsPayable", title: "Accounts Payable", description: "Vendor bills still to pay, with their age.", family: "Purchase & payables" },

  // Finance books
  { path: "/financeReport", title: "Finance Report", description: "Invoiced, collected, outstanding and overdue.", family: "Finance books" },
  { path: "/accountsReceivable", title: "Accounts Receivable", description: "What customers owe, with their age.", family: "Finance books" },
  { path: "/generalLedger", title: "General Ledger", description: "Every posting by account.", family: "Finance books" },
  { path: "/financialStatements", title: "Financial Statements", description: "Trial balance, profit and loss and balance sheet.", family: "Finance books" },
  { path: "/taxReport", title: "Tax Report", description: "Tax charged on sales, month by month.", family: "Finance books" },
  { path: "/vatReturn", title: "VAT Return", description: "The figures for your VAT return, box by box.", family: "Finance books" },
  { path: "/cashFlowForecast", title: "Cash Flow Forecast", description: "Expected money in and out over the coming weeks.", family: "Finance books" },
  { path: "/budgets", title: "Budgets", description: "Budget against actual by account.", family: "Finance books" },

  // HR & stock
  { path: "/inventory-report", title: "Inventory Report", description: "Stock, valuation, movements, cost of goods sold and slow stock.", family: "HR & stock" },
  { path: "/payrollSummary", title: "Payroll Summary", description: "Pay, deductions and net pay by month.", family: "HR & stock" },
  { path: "/departmentSummary", title: "Department Summary", description: "Payroll cost by department.", family: "HR & stock" },
  { path: "/departmentSalary", title: "Department Salary", description: "Salary cost by department for a month or the year to date.", family: "HR & stock" },
  { path: "/att_reports", title: "Attendance Reports", description: "Attendance, lateness and leave by employee.", family: "HR & stock" },
];
