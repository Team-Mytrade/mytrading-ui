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

export const REPORT_TOPICS: HelpTopic[] = [
  {
    id: "purchase-reports",
    route: "/purchase-reports",
    module: "Reports",
    title: "Purchase Reports",
    summary: "Spend on approved purchase orders: by vendor, month by month for the last 12 months, and how long fully received orders took to arrive.",
    who: moduleReader("Purchase"),
    tasks: [{ title: "Read it", steps: ["The cards show Total Spend, Best Month, Avg Turnaround and Vendors; below are the trend, spend by vendor and the turnaround of each order."] }],
    rules: ["Drafts and cancelled orders are left out."],
    related: [
      { route: "/purchase-service/orders", label: "Purchase Orders" },
      { route: "/common/vendors", label: "Vendors" },
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
    id: "finance-report",
    route: "/financeReport",
    module: "Reports",
    title: "Finance Report",
    summary: "Issued sales invoices at a glance: invoiced, collected, outstanding and overdue, by month and by status, with the overdue list.",
    who: moduleReader("Invoice"),
    tasks: [{ title: "Read it", steps: ["The cards show Invoiced, Collected, Outstanding and Overdue; the overdue list shows each invoice's balance."] }],
    rules: ["Drafts and cancelled invoices are left out."],
    related: [
      { route: "/accountsReceivable", label: "Accounts Receivable" },
      { route: "/financialStatements", label: "Financial Statements" },
    ],
  },
  {
    id: "tax-report",
    route: "/taxReport",
    module: "Reports",
    title: "Tax Report",
    summary: "Tax charged on issued sales invoices: taxable value, tax, invoice total and the effective rate, month by month.",
    who: moduleReader("Invoice"),
    tasks: [{ title: "Read it", steps: ["Read the totals and Tax charged by month. Tax paid on purchases is on Tax Records."] }],
    related: [
      { route: "/vatReturn", label: "VAT Return" },
      { route: "/taxRecords", label: "Tax Records" },
    ],
  },
  {
    id: "vat-return",
    route: "/vatReturn",
    module: "Reports",
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
    summary: "What each role may do, module by module: view, create, update, delete, approve, export and admin.",
    who: [
      { role: "Tenant Administrator", can: "Add, change and delete custom roles." },
      { role: "Everyone with Users access", can: "See the roles." },
    ],
    tasks: [
      { title: "See a role", steps: ["Select a role to see its permissions."] },
      { title: "Make a role", steps: ["Click New role and name it (e.g. Sales Executive).", "Tick the permissions per Module and save."] },
      { title: "Change or remove one", steps: ["Click Edit role, or Delete the role (custom roles only). Not assigned counts the roles nobody has."] },
    ],
    rules: [
      "Greyed boxes are permissions you don't hold or don't administer: nobody can give more than they have.",
      "Admin includes every action of its module.",
      "System roles (with a lock) come from the platform: only the Super Admin can change them.",
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
    ],
    related: [
      { route: "/getting-started", label: "Getting started" },
      { route: "/notification-settings", label: "Notification Settings" },
    ],
    flows: ["company-setup"],
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
