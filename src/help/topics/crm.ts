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
      {
        title: "Add a lead",
        steps: [
          "Click Add Lead.",
          "Enter the lead name and email (both required) and the phone.",
          "If the lead is a person, add the company they buy for and their job title.",
          "Choose the source: where the lead came from.",
          "Leave the status New.",
          "The owner is you; pick someone else, or Unassigned, if another person will look after it.",
          "On the Details tab add the country, city, what they are interested in, the expected value and notes.",
          "Save.",
        ],
      },
      {
        title: "Move a lead along",
        steps: [
          "After the first call set the status to Contacted.",
          "When they have a real need and budget, set Qualified.",
          "If it goes nowhere, set Lost and choose why.",
        ],
      },
      {
        title: "Make a lead a customer",
        steps: [
          "Open the lead's row menu.",
          "Choose Convert to Customer, or Link to existing customer if they already are one.",
          "Check the customer's name, type, country, city, address, tax number and sales person (filled in from the lead and its owner), then Convert.",
          "The lead becomes Converted; quote the customer under Sales → Quotations or from the lead's deal.",
        ],
      },
      { title: "Give a lead to someone", steps: ["Edit the lead.", "Choose the new person under Owner, or Unassigned.", "Save: the new owner gets a bell alert."] },
      {
        title: "When it says the lead may already be in the CRM",
        steps: [
          "Read the list: each lead or customer with the same email or phone.",
          "Open one to check it, or Go back to change the details.",
          "If it is someone else, choose Save anyway.",
        ],
      },
    ],
    fields: [
      { name: "Lead name", meaning: "The person or company; required." },
      { name: "Email", meaning: "Required; used when the lead becomes a customer." },
      { name: "Company", meaning: "When the lead is a person: the company they buy for. On convert the company becomes the customer and the person its main contact." },
      { name: "Source", meaning: "Where the lead came from, from your company's list (CRM Settings)." },
      { name: "Expected value", meaning: "What the business could be worth, in the currency chosen (the company's when none)." },
      { name: "Lost reason", meaning: "Why a Lost lead was lost, from your company's list; asked whenever a lead is set to Lost." },
      { name: "Owner", meaning: "Who looks after the lead. A new lead is yours unless you pick someone else; Unassigned means nobody yet." },
    ],
    statuses: [
      { name: "New", meaning: "Just came in; nobody has talked to them yet." },
      { name: "Contacted", meaning: "Someone has spoken to them." },
      { name: "Qualified", meaning: "A real opportunity: worth a deal and a quotation." },
      { name: "Lost", meaning: "Not going ahead." },
      { name: "Converted", meaning: "Now a customer. Set only by Convert to Customer / Link to existing customer." },
    ],
    rules: [
      "The cards count the leads in the list (all of them, or only yours under My leads) and those New, Contacted and Qualified.",
      "When CRM Settings shows sales people only their own, you see the leads you own and the unassigned ones; CRM admins see all.",
      "Before a lead is saved, other leads and customers are checked for the same email or the same phone (compared by its digits, so +971 50 123 4567 and 050 1234567 match), including leads you can't open.",
      "A lead that is set back from Lost loses its lost reason.",
    ],
    related: [
      { route: "/opportunities", label: "Deals", why: "Track what the lead wants to buy." },
      { route: "/activities", label: "Tasks", why: "Plan the follow-up." },
      { route: "/customer-management", label: "Customers" },
      { route: "/crm-settings", label: "CRM Settings", why: "Who sees which leads and deals." },
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
          "The owner is you; pick someone else, or Unassigned, if another person will work the deal.",
          "Save.",
        ],
      },
      { title: "Move a deal through the pipeline", steps: ["Edit the deal and set the stage: Prospecting → Qualified → Negotiation → Won or Lost."] },
      {
        title: "Make a quotation from a deal",
        steps: [
          "The deal must belong to a customer: convert or link its lead first.",
          "From the deal choose to create the quotation: Sales → Quotations opens with the customer and lines filled in, and the owner as sales person when the owner is set up as one.",
          "Check prices and save the quotation; the deal shows the quotation number.",
        ],
      },
    ],
    fields: [
      { name: "Amount", meaning: "The deal's value; empty = the total of its product lines." },
      { name: "Expected close date", meaning: "When you expect a decision; drives the pipeline report." },
      { name: "Lead / Customer", meaning: "Who the deal is with. A deal needs one of them." },
      { name: "Owner", meaning: "Who works the deal. A new deal is yours unless you pick someone else; a new owner gets a bell alert." },
    ],
    statuses: [
      { name: "Prospecting / Qualified / Negotiation", meaning: "Open stages, from first interest to agreeing terms." },
      { name: "Won", meaning: "The customer agreed: quote and sell." },
      { name: "Lost", meaning: "The customer said no." },
      { name: "Active / Cancelled", meaning: "Status of an open deal; Won and Lost follow the stage." },
    ],
    rules: [
      "The cards show the deals in the list (all of them, or only yours under My deals): all, active, total value and average deal size.",
      "When CRM Settings shows sales people only their own, you see the deals you own and the unassigned ones; CRM admins see all.",
    ],
    related: [
      { route: "/leads", label: "Leads" },
      { route: "/quotations", label: "Quotations", why: "The quotation made from the deal." },
      { route: "/crm-reports", label: "CRM Reports", why: "Pipeline and win rate." },
      { route: "/crm-settings", label: "CRM Settings", why: "Who sees which leads and deals." },
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
    rules: [
      "The completed time can't be before the scheduled time.",
      "My tasks shows only the tasks assigned to you.",
      "When CRM Settings shows sales people only their own, you see the tasks assigned to you, added by you or on a lead you can see, and every task about a customer.",
    ],
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
    rules: [
      "Type, subject and date are required.",
      "The cards count all communications and the emails, calls and meetings.",
      "When CRM Settings shows sales people only their own, you see the interactions you logged, those on a lead you can see, and every one about a customer.",
    ],
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
    rules: ["When CRM Settings shows sales people only their own, the figures and exports count only the leads, deals, tasks and interactions you can see."],
    related: [
      { route: "/opportunities", label: "Deals" },
      { route: "/leads", label: "Leads" },
    ],
  },
  {
    id: "crm-settings",
    route: "/crm-settings",
    module: "CRM",
    title: "CRM Settings",
    summary:
      "Your company's own CRM rules: whether sales people see everyone's leads and deals or only their own, and the lists of lead sources and lost reasons.",
    who: [
      { role: "CRM admin", can: "Change the settings and the lists (needs the CRM admin right, as the CRM Admin and Tenant Admin roles have)." },
      { role: "Everyone in the CRM", can: "See what is set." },
    ],
    tasks: [
      {
        title: "Show sales people only their own leads and deals",
        steps: [
          "Open CRM → CRM Settings.",
          "Switch on Sales people see only their own leads and deals.",
          "It applies at once: each person's lists, CRM dashboard and CRM reports now hold only what they can see.",
        ],
        who: "CRM admin",
      },
      {
        title: "Hand over a sales person's work",
        steps: ["Open Leads or Deals and edit each record.", "Pick the new person under Owner and save.", "The new owner gets a bell alert and sees the record straight away."],
      },
      {
        title: "Change the lead sources or lost reasons",
        steps: [
          "Under Lists, type a new entry and click Add, or remove one with its ×; the arrow moves an entry up.",
          "Click Save list.",
          "Use the standard list puts back the list every company starts with.",
        ],
        who: "CRM admin",
      },
    ],
    fields: [
      { name: "Owner", meaning: "The login responsible for a lead or deal; set on Leads and Deals." },
      { name: "Lead sources", meaning: "The Source choices on a lead (Walk-in, Website, Exhibition…)." },
      { name: "Lost reasons", meaning: "The reasons offered when a lead is set to Lost (Price, Lost to competitor…)." },
    ],
    rules: [
      "CRM admins and Tenant Admins always see everything.",
      "Unassigned leads and deals stay visible to everyone, so anyone can take one by making themselves its owner.",
      "Tasks and interactions about a customer only stay visible to everyone: customers are shared by the whole company.",
      "A lead or deal you can't see can't be opened, edited or linked to a task, interaction or deal.",
      "Leads and deals added before owners existed are unassigned until someone becomes their owner.",
      "A list keeps at least one entry and up to 30, each up to 50 characters. Removing an entry doesn't change the leads that already have it.",
    ],
    related: [
      { route: "/leads", label: "Leads" },
      { route: "/opportunities", label: "Deals" },
      { route: "/rolesPermissions", label: "Roles & Permissions", why: "Who has the CRM admin right." },
    ],
  },
];
