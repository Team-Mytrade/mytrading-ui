import type { HelpTopic } from "../types";

// Common: the master data and people every module uses (menu: Common).
export const COMMON_TOPICS: HelpTopic[] = [
  {
    id: "customers",
    route: "/customer-management",
    // The customer view and the add / edit pages
    aliases: ["/crm-view/customers", "/customers"],
    module: "Common",
    title: "Customers",
    summary:
      "Everyone you sell to: their contact and tax details, addresses, currency, payment terms and credit limit. Quotations, sales orders, deliveries and invoices all pick the customer from here.",
    who: [
      { role: "CRM Manager", can: "Add, edit and delete customers; change their status." },
      { role: "CRM Executive", can: "Add and edit customers, record communications, add them to segments." },
      { role: "Sales, Finance and Delivery", can: "See customers (to pick them on their documents)." },
    ],
    tasks: [
      {
        title: "Add a customer",
        steps: [
          "Click Add Customer.",
          "Enter the customer name and choose the customer type and status (new customers are usually Active).",
          "Add the tax number (GSTIN or VAT TRN) if the customer is registered: it is printed on tax invoices.",
          "Add the billing address (and a delivery address if goods go elsewhere).",
          "Choose the currency, payment terms and, if you give credit, the credit limit.",
          "Save.",
        ],
      },
      {
        title: "Put a customer on hold or stop selling to them",
        steps: ["Open the customer's row menu and choose Edit Customer.", "Set the status to Credit hold or Blocked.", "Save."],
        who: "CRM Manager",
      },
      {
        title: "Record a call, email or meeting",
        steps: ["Open the customer's row menu and choose Add Communication.", "Enter the subject and notes.", "Save: it appears under CRM → Interactions."],
      },
      {
        title: "Add a customer to a segment",
        steps: ["Open the row menu and choose Add to Segment.", "Pick the segment.", "Save."],
      },
    ],
    fields: [
      { name: "Customer name / Trade name", meaning: "The legal name (on invoices) and the name the customer trades under, if different." },
      { name: "Customer type", meaning: "Wholesale, Retail, Distributor, Corporate, Government, Non-profit or Other. Used in reports and price lists." },
      { name: "GSTIN / VAT TRN", meaning: "The customer's tax registration. A registered buyer gets a full tax invoice; without it a Saudi invoice is a simplified one." },
      { name: "Payment terms", meaning: "How many days the customer has to pay. Sets the due date on invoices." },
      { name: "Currency", meaning: "The currency quotations, orders and invoices for this customer are made in." },
      { name: "Credit limit", meaning: "How much the customer may owe. Empty = no limit. An order that would take them over it goes on credit hold until a manager releases it." },
      { name: "Sales person", meaning: "Who looks after the customer; used for targets and commission." },
    ],
    statuses: [
      { name: "Active", meaning: "You can quote, sell and invoice." },
      { name: "Credit hold", meaning: "New orders wait for a manager to release them." },
      { name: "Blocked", meaning: "No new documents for this customer." },
      { name: "Inactive", meaning: "No longer a customer; kept for history." },
    ],
    rules: [
      "To stop using a customer, set it Inactive rather than deleting it: its documents and history stay intact.",
      "The cards at the top count all customers, active ones, leads and those on credit hold.",
    ],
    related: [
      { route: "/leads", label: "Leads", why: "A won lead becomes a customer." },
      { route: "/quotations", label: "Quotations", why: "Quote the customer." },
      { route: "/credit-limit", label: "Credit Limit", why: "See each customer's credit use." },
      { route: "/accountsReceivable", label: "Accounts Receivable", why: "What the customer owes." },
    ],
    flows: ["lead-to-order", "order-to-cash"],
  },
  {
    id: "vendors",
    route: "/common/vendors",
    module: "Common",
    title: "Vendors",
    summary: "Everyone you buy from. Purchase picks vendors for requisitions, quotation requests and orders; Finance uses them for bills and payments.",
    who: [
      { role: "Product Catalogue Manager / Executive", can: "Add and edit vendors (the Manager can delete)." },
      { role: "Purchase and Finance", can: "See vendors (to pick them on their documents)." },
    ],
    tasks: [
      {
        title: "Add a vendor",
        steps: [
          "Click Add Vendors.",
          "Enter the vendor code (e.g. VEN-001) and vendor name; add the legal (registered) name if different.",
          "Enter the contact person, email and phone.",
          "Enter the address, the currency the vendor bills in and the payment terms.",
          "Add the GSTIN / VAT TRN (in India the PAN is filled in from the GSTIN) and the bank details for payments.",
          "Save.",
        ],
      },
      { title: "Stop using a vendor", steps: ["Open the vendor and choose Edit.", "Set it Inactive.", "Save: it no longer appears on new orders."] },
    ],
    fields: [
      { name: "Vendor code", meaning: "Your short code for the vendor, unique within your company." },
      { name: "Currency", meaning: "The currency the vendor quotes and bills in. Bills in another currency are converted at the day's exchange rate." },
      { name: "Payment terms", meaning: "Days you have to pay the vendor; sets the due date on bills." },
      { name: "GSTIN / VAT TRN", meaning: "The vendor's tax registration, needed to reclaim input tax." },
      { name: "Bank name, account number, IFSC", meaning: "Where vendor payments go." },
    ],
    statuses: [
      { name: "Active", meaning: "Can be used on new requisitions, orders and bills." },
      { name: "Inactive", meaning: "Kept for history; not offered on new documents." },
    ],
    related: [
      { route: "/purchase-service/orders", label: "Purchase Orders", why: "Order from the vendor." },
      { route: "/purchaseInvoices", label: "Purchase Invoices", why: "The vendor's bills." },
      { route: "/vendorPayments", label: "Vendor Payments", why: "Pay the vendor." },
    ],
    flows: ["procure-to-pay"],
  },
  {
    id: "product-categories",
    route: "/common/categories",
    module: "Common",
    title: "Product Categories",
    summary: "Groups of products (e.g. Mobiles, Cement, Beverages). Every product belongs to a category, and the category's short code is part of the product code.",
    who: [{ role: "Product Catalogue Manager / Executive", can: "Add and edit categories (the Manager can delete)." }],
    tasks: [
      {
        title: "Add a category",
        steps: [
          "Click Add Product Categories.",
          "Enter the category code (e.g. PHARMA) and name.",
          "Enter a short code (e.g. PHR): it starts the codes of the products in this category.",
          "To make a sub-category, choose its parent category.",
          "Save.",
        ],
      },
    ],
    fields: [
      { name: "Category code", meaning: "Unique within your company. Letters and digits; no \"-\" (it separates the parts of a product code)." },
      { name: "Short code", meaning: "Used to build product codes in this category." },
      { name: "Parent category", meaning: "Leave empty for a main category." },
      { name: "Active", meaning: "Inactive categories can't take new products." },
    ],
    related: [{ route: "/common/products", label: "Products" }],
  },
  {
    id: "products",
    route: "/common/products",
    module: "Common",
    title: "Products",
    summary: "Everything you buy, stock and sell, goods and services. Every module picks products from here: quotations, orders, receipts, stock and invoices.",
    who: [
      { role: "Product Catalogue Manager / Executive", can: "Add and edit products (the Manager can delete)." },
      { role: "Sales, Purchase, Inventory, Finance", can: "See products and prices." },
    ],
    tasks: [
      {
        title: "Add a product",
        steps: [
          "Click Add Products.",
          "Choose the category and enter the product name (and a short name for narrow screens and receipts).",
          "Choose the unit of measure (Pieces, Box, Pack, Bag, Roll, Kilogram, Litre…).",
          "Enter the standard cost and the selling price.",
          "Choose the tax code (e.g. VAT5, VAT15, GST18): it must match a code under Common → Tax Types.",
          "Tick Stock item for goods you keep in stock, or Service item for services (sold and invoiced without stock).",
          "Tick Batch, Expiry or Serial tracking if the goods need it.",
          "Save: the product code is made from the category's short code.",
        ],
      },
      {
        title: "Add a product picture",
        steps: ["Open the product and upload a PNG, JPEG or WebP image of up to 5 MB.", "Or choose Use Initial for a picture made from the name."],
      },
    ],
    fields: [
      { name: "UOM", meaning: "The unit you count it in. Orders, stock and invoices use the same unit." },
      { name: "Tax code", meaning: "The tax applied when it is sold or bought (rate in Tax Types). Empty for companies that don't charge tax." },
      { name: "HS code / SAC", meaning: "Customs code for goods, service code for services; printed on export and GST invoices." },
      { name: "Barcode", meaning: "EAN/UPC, 8 to 14 digits; the Point of Sale finds the product by it." },
      { name: "Stock item / Service item", meaning: "Stock items need stock to be dispatched; service items are invoiced without stock." },
      { name: "Batch / Expiry / Serial tracking", meaning: "Receipts and dispatches then ask for batch numbers, expiry dates or serials. Expiry tracking needs batch tracking." },
    ],
    statuses: [
      { name: "Active", meaning: "Can be used on new documents." },
      { name: "Inactive", meaning: "Kept for history; not offered on new documents." },
    ],
    related: [
      { route: "/common/categories", label: "Product Categories" },
      { route: "/taxTypes", label: "Tax Types", why: "The tax codes products use." },
      { route: "/inventory", label: "Stock on Hand", why: "How much is in stock." },
      { route: "/sales-price-lists", label: "Price Lists", why: "Special prices per customer or quantity." },
    ],
  },
  {
    id: "employees",
    route: "/employeeRecords",
    aliases: ["/addEmployee", "/employees"],
    module: "Common",
    title: "Employees",
    summary:
      "Everyone who works for the company. Adding an employee also creates their login, so they can use My Attendance, apply for leave and see their payslips.",
    who: [
      { role: "HR Manager", can: "Add, edit and deactivate employees; export the list." },
      { role: "HR Executive", can: "Add and edit employees." },
    ],
    tasks: [
      {
        title: "Add an employee",
        steps: [
          "Click Add Employee.",
          "Enter the name, gender, date of birth and phone.",
          "Enter the official email: it becomes the employee's login name.",
          "Choose the department (or type a new one), designation, joining date, employment type and line manager.",
          "Choose the role the login gets (what the employee may do in MyTrade).",
          "Add the address, bank details (for salary) and, if HR sets pay here, the salary components.",
          "Save. The login is created; when e-mail is set up the employee gets an invitation to set a password.",
        ],
      },
      { title: "Find an employee", steps: ["Use the search and filters above the list.", "Click View Details for the full record."] },
      {
        title: "When someone leaves",
        steps: ["Use HRMS → Exit Management / Exit Approvals for resignations (final settlement included).", "Delete here only deactivates the employee and their login."],
        who: "HR Manager",
      },
      { title: "Export the list", steps: ["Click Export to download the employees as a spreadsheet."], who: "HR Manager" },
    ],
    fields: [
      { name: "Employee code", meaning: "Your code for the employee, unique within the company." },
      { name: "Line manager", meaning: "Approves the employee's leave and attendance requests." },
      { name: "Employment type", meaning: "Full time, Part time or Contract." },
      { name: "Role", meaning: "The access role of the employee's login (Settings → Roles & Permissions)." },
    ],
    rules: [
      "Self-service pages (My Attendance, leave, payslips) work only for a login linked to an employee.",
      "The cards show the total, active employees, departments and people who joined in the last 30 days.",
    ],
    related: [
      { route: "/employeeDepartments", label: "Departments" },
      { route: "/salaryStructure", label: "Salary Structure", why: "Set the employee's pay." },
      { route: "/role_config", label: "Users", why: "The employee's login and roles." },
    ],
    flows: ["hire-to-pay"],
  },
  {
    id: "departments",
    route: "/employeeDepartments",
    module: "Common",
    title: "Departments",
    summary: "The company's departments. Every employee belongs to one; payroll and attendance reports group by them.",
    who: [{ role: "HR Manager / Executive", can: "Add and edit departments (the Manager can delete)." }],
    tasks: [
      { title: "Add a department", steps: ["Click Add Department.", "Enter the department name (required).", "Save."] },
      { title: "Rename or remove a department", steps: ["Choose Edit Department to rename it.", "Choose Delete Department to remove one that is no longer used."], who: "HR Manager" },
    ],
    rules: ["The cards show the number of departments, employees, the average per department and the largest one."],
    related: [
      { route: "/employeeRecords", label: "Employees" },
      { route: "/departmentSummary", label: "Department Summary", why: "Payroll cost per department." },
    ],
  },
  {
    id: "payment-terms",
    route: "/paymentTerms",
    module: "Common",
    title: "Payment Terms",
    summary: "How long customers have to pay you and you have to pay vendors (e.g. NET 30). Customers, vendors, orders and invoices use these to set due dates.",
    who: [{ role: "Finance Manager / Executive", can: "Add and edit payment terms (the Manager can delete)." }],
    tasks: [
      {
        title: "Add a payment term",
        steps: [
          "Click Add Payment Term.",
          "Enter the days until payment is due (e.g. 30).",
          "Enter a term code, or leave it blank to have NET + days (e.g. NET30).",
          "Add a description (e.g. \"30 days from invoice\").",
          "Save.",
        ],
      },
      { title: "Find terms", steps: ["Search by code or description, or filter to 30 days or less / more than 30 days."] },
    ],
    fields: [
      { name: "Term code", meaning: "Short name shown on documents; blank = NET + days." },
      { name: "Due in (days)", meaning: "Days from the invoice date to the due date." },
    ],
    related: [
      { route: "/customer-management", label: "Customers" },
      { route: "/common/vendors", label: "Vendors" },
    ],
  },
  {
    id: "tax-types",
    route: "/taxTypes",
    module: "Common",
    title: "Tax Types",
    summary: "The tax rates your company charges and pays (e.g. VAT5 = VAT 5%, GST18 = GST 18%). A product's tax code points to one of these.",
    who: [{ role: "Finance Manager / Executive", can: "Add and edit tax types (the Manager can delete)." }],
    tasks: [
      {
        title: "Add a tax type",
        steps: [
          "Click Add Tax Type.",
          "Enter the tax code exactly as products use it (e.g. VAT5).",
          "Enter the rate in percent (5 for 5%).",
          "Choose the VAT category (standard, zero-rated, exempt…) and the region.",
          "Save.",
        ],
      },
    ],
    fields: [
      { name: "Tax code", meaning: "The code on products and invoice lines; must match exactly." },
      { name: "Tax rate (%)", meaning: "In percent: 5 means 5%." },
      { name: "VAT category", meaning: "How the line is reported on the VAT return and e-invoice (standard, zero-rated, exempt, out of scope)." },
    ],
    statuses: [
      { name: "Active", meaning: "Offered on products and documents." },
      { name: "Inactive", meaning: "Kept for old documents only." },
    ],
    related: [
      { route: "/common/products", label: "Products" },
      { route: "/vatReturn", label: "VAT Return" },
      { route: "/reports/sales-register", label: "Sales Register" },
    ],
  },
  {
    id: "tax-details",
    route: "/taxDetails",
    module: "Common",
    title: "Tax Details",
    summary: "Tax lines by code, split into input tax (on purchases, which you reclaim) and output tax (on sales, which you owe).",
    who: [{ role: "Finance Manager / Executive", can: "Add and edit tax details (the Manager can delete)." }],
    tasks: [
      {
        title: "Add a tax detail",
        steps: ["Click Add Tax Detail.", "Enter the tax code (required), description and rate.", "Enter the tax amount.", "Save."],
      },
    ],
    fields: [
      { name: "Input tax", meaning: "Tax paid on purchases; reclaimable." },
      { name: "Output tax", meaning: "Tax charged on sales; owed to the tax authority." },
    ],
    related: [
      { route: "/taxTypes", label: "Tax Types" },
      { route: "/taxRecords", label: "Tax Records" },
    ],
  },
];
