import type { HelpTopic } from "../types";

const CRM_WHO = [
  { role: "CRM Manager", can: "Everything on the page, including delete and export." },
  { role: "CRM Executive", can: "Add, edit and follow up; not delete or export." },
];

// CRM: from the first contact to a customer and a quotation (menu: CRM).
export const CRM_TOPICS: HelpTopic[] = [
  {
    id: "leads",
    route: "/leads",
    module: "CRM",
    title: "Leads",
    summary: "People and companies that may become customers. Follow each lead from New to Qualified, then make it a customer.",
    who: CRM_WHO,
    tasks: [
      { title: "Add a lead", steps: ["Click Add Lead.", "Enter the lead name and email (both required) and the phone.", "Leave the status New.", "Save."] },
      {
        title: "Move a lead along",
        steps: ["After the first call set the status to Contacted.", "When they have a real need and budget, set Qualified.", "If it goes nowhere, set Lost."],
      },
      {
        title: "Make a lead a customer",
        steps: [
          "Open the lead's row menu.",
          "Choose Convert to Customer to create a new customer from the lead, or Link to existing customer if they already are one.",
          "The lead becomes Converted; quote the customer under Sales → Quotations or from the lead's deal.",
        ],
      },
    ],
    fields: [
      { name: "Lead name", meaning: "The person or company; required." },
      { name: "Email", meaning: "Required; used when the lead becomes a customer." },
    ],
    statuses: [
      { name: "New", meaning: "Just came in; nobody has talked to them yet." },
      { name: "Contacted", meaning: "Someone has spoken to them." },
      { name: "Qualified", meaning: "A real opportunity: worth a deal and a quotation." },
      { name: "Lost", meaning: "Not going ahead." },
      { name: "Converted", meaning: "Now a customer. Set only by Convert to Customer / Link to existing customer." },
    ],
    rules: ["The cards count all leads and those New, Contacted and Qualified."],
    related: [
      { route: "/opportunities", label: "Deals", why: "Track what the lead wants to buy." },
      { route: "/activities", label: "Tasks", why: "Plan the follow-up." },
      { route: "/customer-management", label: "Customers" },
    ],
    flows: ["lead-to-order"],
  },
  {
    id: "deals",
    route: "/opportunities",
    module: "CRM",
    title: "Deals",
    summary:
      "Sales opportunities: what a lead or customer wants to buy, how much it is worth and how close it is. A deal can become a quotation with its lines filled in.",
    who: CRM_WHO,
    tasks: [
      {
        title: "Add a deal",
        steps: [
          "Click Add Opportunity.",
          "Enter the deal name and link it to a lead or a customer (one of them is required).",
          "Add the products or services asked for, with quantities.",
          "Leave Amount empty to use the total of the lines, or enter the expected value.",
          "Choose the stage and the expected close date.",
          "Save.",
        ],
      },
      { title: "Move a deal through the pipeline", steps: ["Edit the deal and set the stage: Prospecting → Qualified → Negotiation → Won or Lost."] },
      {
        title: "Make a quotation from a deal",
        steps: [
          "The deal must belong to a customer: convert or link its lead first.",
          "From the deal choose to create the quotation: Sales → Quotations opens with the customer and lines filled in.",
          "Check prices and save the quotation; the deal shows the quotation number.",
        ],
      },
    ],
    fields: [
      { name: "Amount", meaning: "The deal's value; empty = the total of its product lines." },
      { name: "Expected close date", meaning: "When you expect a decision; drives the pipeline report." },
      { name: "Lead / Customer", meaning: "Who the deal is with. A deal needs one of them." },
    ],
    statuses: [
      { name: "Prospecting / Qualified / Negotiation", meaning: "Open stages, from first interest to agreeing terms." },
      { name: "Won", meaning: "The customer agreed: quote and sell." },
      { name: "Lost", meaning: "The customer said no." },
      { name: "Active / Cancelled", meaning: "Status of an open deal; Won and Lost follow the stage." },
    ],
    rules: ["The cards show all deals, active deals, total value and average deal size."],
    related: [
      { route: "/leads", label: "Leads" },
      { route: "/quotations", label: "Quotations", why: "The quotation made from the deal." },
      { route: "/crm-reports", label: "CRM Reports", why: "Pipeline and win rate." },
    ],
    flows: ["lead-to-order"],
  },
  {
    id: "crm-tasks",
    route: "/activities",
    module: "CRM",
    title: "Tasks",
    summary: "Follow-up work for the sales team: calls to make, meetings, emails and to-dos, each for a lead, customer or contact.",
    who: CRM_WHO,
    tasks: [
      {
        title: "Plan a follow-up",
        steps: [
          "Click New Activity.",
          "Enter a title and choose the activity type (Call, Meeting, Email or Task); both are required.",
          "Choose who it is assigned to, the priority and the scheduled time.",
          "Link it to the lead, customer or contact it is about.",
          "Save.",
        ],
      },
      { title: "Close a task", steps: ["Edit it, set the status to Completed and the completed time.", "Or set Cancelled if it is no longer needed."] },
    ],
    statuses: [
      { name: "Pending", meaning: "Still to do." },
      { name: "Completed", meaning: "Done; the completed time is recorded." },
      { name: "Cancelled", meaning: "Not needed any more." },
    ],
    fields: [{ name: "Priority", meaning: "Low, Medium or High; high-priority tasks are counted on the card at the top." }],
    rules: ["The completed time can't be before the scheduled time."],
    related: [
      { route: "/communication-history", label: "Interactions", why: "Record what was said." },
      { route: "/leads", label: "Leads" },
    ],
  },
  {
    id: "crm-interactions",
    route: "/communication-history",
    module: "CRM",
    title: "Interactions",
    summary: "The history of every email, call, meeting and message with leads and customers, so anyone can see what was last said.",
    who: CRM_WHO,
    tasks: [
      {
        title: "Record a conversation",
        steps: [
          "Click New Communication.",
          "Choose the lead or the customer (one is required) and, if you like, the contact person.",
          "Choose the type (Email, Call, Meeting, Video call, Chat, SMS, Other) and the date and time.",
          "Enter the subject and notes.",
          "Save.",
        ],
      },
      { title: "Read the notes", steps: ["Click View Notes on a row."] },
    ],
    rules: ["Type, subject and date are required.", "The cards count all communications and the emails, calls and meetings."],
    related: [
      { route: "/activities", label: "Tasks", why: "Plan the next step." },
      { route: "/contactPerson", label: "Key Contacts" },
    ],
  },
  {
    id: "key-contacts",
    route: "/contactPerson",
    module: "CRM",
    title: "Key Contacts",
    summary: "The people you deal with at each customer, and their part in buying decisions.",
    who: CRM_WHO,
    tasks: [
      {
        title: "Add a contact",
        steps: [
          "Click Add Contact Person.",
          "Enter the full name (required), email, phone and designation.",
          "Choose the company (customer) they work for (required) and their role.",
          "Save.",
        ],
      },
    ],
    fields: [{ name: "Role", meaning: "Decision maker, Influencer, Buyer or User: who to talk to about what." }],
    rules: ["The cards count all contacts, those linked to customers, decision makers and influencers."],
    related: [{ route: "/customer-management", label: "Customers" }],
  },
  {
    id: "segments",
    route: "/customer-segment",
    module: "CRM",
    title: "Segments",
    summary: "Groups of customers (e.g. Key accounts, Hospitals, Retail chains) for targeting and reports.",
    who: CRM_WHO,
    tasks: [
      { title: "Make a segment", steps: ["Click Add Segment.", "Enter the segment name (required) and a description.", "Save."] },
      {
        title: "Add or remove customers",
        steps: ["Open the segment and choose Manage customers.", "Search by name, email, phone or code and tick the customers.", "Add or remove them in one go."],
      },
    ],
    rules: ["The cards count segments, active ones, customers in segments and empty segments."],
    related: [{ route: "/customer-management", label: "Customers", why: "Add one customer at a time from its row menu." }],
  },
  {
    id: "crm-reports",
    route: "/crm-reports",
    module: "CRM",
    title: "CRM Reports",
    summary: "How the pipeline is doing: leads, deals, pipeline value, won value, conversion and win rate, with charts by stage, status and activity type.",
    who: [
      { role: "CRM Manager", can: "See the reports and export leads, deals, segments, activities and communications." },
      { role: "CRM Executive", can: "See the reports." },
    ],
    tasks: [
      { title: "Read the pipeline", steps: ["Look at Pipeline (open deal value) and Won Value.", "Deals by Stage shows where deals are stuck."] },
      { title: "Export a list", steps: ["Choose what to export (Leads, Deals, Segments, Activities, Comms).", "The file downloads as a spreadsheet."], who: "CRM Manager" },
    ],
    fields: [
      { name: "Conversion", meaning: "Share of leads that became customers." },
      { name: "Win rate", meaning: "Won deals out of closed (won + lost) deals." },
      { name: "Avg deal", meaning: "Average value of the deals." },
    ],
    related: [
      { route: "/opportunities", label: "Deals" },
      { route: "/leads", label: "Leads" },
    ],
  },
];
