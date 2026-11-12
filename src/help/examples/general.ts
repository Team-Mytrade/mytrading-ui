import type { HelpExample } from "../types";

// Examples for Home and Settings (topics/general.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data).
export const GENERAL_EXAMPLES: Record<string, HelpExample> = {
  "command-center": {
    story: "Monday 9 am: Ahmed Al Mansoori, the sales manager, signs in and opens the Command Center.",
    data: [
      { label: "Needs your attention", value: "3 quotations to approve · 2 orders on credit hold" },
      { label: "Sales this month", value: "AED 412,580" },
      { label: "Overdue receivables", value: "AED 38,839.50 (Emirates IT Mart)" },
      { label: "Low stock", value: "Anker 65W USB-C Charger: 12 left, reorder at 40" },
    ],
    result: "He clicks the credit-hold line and lands on the two sales orders waiting for him.",
  },
  "ask-mytrade": {
    story: "Fatima Khan from finance types a question instead of building a report.",
    data: [
      { label: "Question", value: "Who owes us the most this month?" },
      { label: "Answer", value: "Emirates IT Mart: AED 38,839.50, 12 days overdue" },
      { label: "Link", value: "Accounts Receivable → Emirates IT Mart" },
    ],
    result: "She opens the link to send a statement; nothing in the books was changed by asking.",
  },
  "my-profile": {
    story: "Priya Menon, a finance executive, sets up her profile on her first day.",
    data: [
      { label: "Photo", value: "priya.jpg" },
      { label: "Language", value: "English" },
      { label: "Time zone", value: "Asia/Dubai" },
      { label: "Date format", value: "13 Nov 2026" },
    ],
    result: "Dates and times across the app now show in Dubai time and her chosen format.",
  },
  users: {
    story: "The admin invites a new sales executive, Omar Haddad.",
    data: [
      { label: "Email", value: "sales.user6@gulf-electronics.test" },
      { label: "Name", value: "Omar Haddad" },
      { label: "Role", value: "Sales Executive" },
      { label: "Employee", value: "EMP-0058 · Omar Haddad" },
    ],
    result: "Omar gets an invitation email, sets his password and sees only the Sales pages his role allows.",
  },
  "roles-permissions": {
    story: "The admin makes a role for warehouse supervisors who may adjust stock but not delete anything.",
    data: [
      { label: "Role name", value: "Warehouse Supervisor" },
      { label: "Inventory", value: "View, Create, Update, Approve" },
      { label: "Purchase", value: "View" },
      { label: "Product Catalogue", value: "View" },
    ],
    result: "Everyone given this role can approve stock adjustments; the Delete buttons are hidden for them.",
  },
  "getting-started": {
    story: "A new company works through the setup checklist on its first day.",
    data: [
      { label: "Company details", value: "Gulf Electronics Trading L.L.C. · TRN 100458712300003 ✔" },
      { label: "Chart of accounts", value: "Started from the standard chart ✔" },
      { label: "Bank account", value: "Emirates NBD current account ✔" },
      { label: "Opening data", value: "8 products, 5 customers, 5 vendors imported" },
      { label: "Users", value: "2 of 3 invited" },
    ],
    result: "Each step ticks itself when it's done; the banner disappears once all are complete.",
  },
  "company-settings": {
    story: "The admin fills in the company profile that prints on every invoice.",
    data: [
      { label: "Legal name", value: "Gulf Electronics Trading L.L.C." },
      { label: "Address", value: "Office 1204, Al Fahidi Tower, Khalid Bin Al Waleed Road, Dubai" },
      { label: "Currency", value: "AED" },
      { label: "Tax number (TRN)", value: "100458712300003" },
      { label: "Trade licence", value: "DED-845123" },
    ],
    result: "New invoices, quotations and payslips carry this name, address, TRN and logo.",
  },
  "notification-settings": {
    story: "Finance turns on payment reminders so customers hear before and after a due date.",
    data: [
      { label: "Invoice issued email", value: "On" },
      { label: "Reminder before due", value: "3 days" },
      { label: "Overdue reminders", value: "7, 14 and 30 days after due" },
    ],
    result: "Emirates IT Mart gets an email 3 days before invoice INV-2026-00318 falls due.",
  },
  "audit-log": {
    story: "A customer's credit limit changed and the finance manager wants to know who did it.",
    data: [
      { label: "Search", value: "Smart Office Solutions" },
      { label: "When", value: "12 Nov 2026, 16:42" },
      { label: "Who", value: "rahul.menon (Sales Manager)" },
      { label: "Change", value: "Credit limit 50,000 → 80,000" },
    ],
    result: "The record shows exactly who changed what and when.",
  },
  "api-keys": {
    story: "IT connects the company website to MyTrading to read stock levels.",
    data: [
      { label: "Key name", value: "Website stock feed" },
      { label: "Access", value: "Inventory: read" },
      { label: "Key", value: "mt_live_7Hq…  (shown once)" },
    ],
    result: "The website reads live stock; stopping the key cuts it off at once.",
  },
  webhooks: {
    story: "The accounting firm wants to hear about every new invoice.",
    data: [
      { label: "URL", value: "https://hooks.example-accountants.ae/mytrading" },
      { label: "Events", value: "invoice.issued, payment.received" },
      { label: "Last delivery", value: "200 OK · 13 Nov 2026 10:05" },
    ],
    result: "Each time an invoice is issued, their system receives it within seconds.",
  },
  "customer-portal": {
    story: "Al Noor Electronics Retail wants to see its own invoices without calling.",
    data: [
      { label: "Customer", value: "Al Noor Electronics Retail" },
      { label: "Contact", value: "accounts@alnoor-retail.test" },
      { label: "Can see", value: "Invoices, statements, payments" },
    ],
    result: "Their accountant signs in to the portal and downloads INV-2026-00305 as a PDF.",
  },
  "data-import": {
    story: "On go-live, the admin brings in the products from the old system's spreadsheet.",
    data: [
      { label: "What", value: "Products" },
      { label: "File", value: "products-gulf-electronics.xlsx (8 rows)" },
      { label: "Check", value: "8 ready · 0 errors" },
    ],
    result: "All 8 products are added together; if one row had an error, nothing would be imported.",
  },
  "platform-tenants": {
    story: "The platform admin creates the company for a new subscriber.",
    data: [
      { label: "Company", value: "Gulf Electronics Trading LLC" },
      { label: "Admin email", value: "admin@gulf-electronics.test" },
      { label: "Modules", value: "Sales, Purchase, Inventory, Finance, CRM, Delivery, HR, Attendance" },
      { label: "Plan", value: "Business" },
    ],
    result: "The company admin gets an invitation and starts the Getting started checklist.",
  },
  "platform-plans": {
    story: "The platform admin defines a mid-size plan.",
    data: [
      { label: "Plan", value: "Business" },
      { label: "Users", value: "Up to 75" },
      { label: "Modules", value: "All" },
      { label: "Price", value: "AED 2,400 / month" },
    ],
    result: "Companies on Business can add users until they reach 75.",
  },
};
