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
      {
        title: "Move a deal through the pipeline",
        steps: [
          "Choose Board above the list: one column per stage, Prospecting → Qualified → Negotiation → Won and Lost.",
          "Drag the deal's card to the next column, or pick the stage under Move to… on the card (easier on a phone). The probability changes to the new stage's own.",
          "In the Table view, change the stage straight from the list, or edit the deal and set the stage.",
          "Moving a deal to Won asks you to confirm: it closes at 100%, dated today.",
          "Setting Lost asks why: pick the reason and, if you like, add a note.",
        ],
      },
      {
        title: "Find the deals that need you",
        steps: [
          "Pick a person under All owners to see their deals, or Unassigned for the ones nobody works yet.",
          "Pick Close date passed to see open deals whose expected close date is behind you; on the board their date is red.",
          "Or pick Closing this month, Closing next month, a month, or No close date.",
          "Clear filters shows every deal again. The page remembers whether you last used Board or Table.",
        ],
      },
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
      { name: "Probability", meaning: "How likely the deal is to be won, in %. It takes the stage's own (CRM Settings) when the deal moves; change it if this deal is different. Won is 100% and Lost 0%." },
      { name: "Lost reason", meaning: "Why a Lost deal was lost, from your company's list, with an optional note." },
    ],
    statuses: [
      { name: "Prospecting / Qualified / Negotiation", meaning: "Open stages, from first interest to agreeing terms." },
      { name: "Won", meaning: "The customer agreed: quote and sell. The day it was won is recorded." },
      { name: "Lost", meaning: "The customer said no. The day and the reason are recorded." },
      { name: "Active / Cancelled", meaning: "Status of an open deal; Won and Lost follow the stage." },
    ],
    rules: [
      "The cards show the deals in the list (all of them, or only yours under My deals): all, active, pipeline value, weighted pipeline (each open deal × its probability) and average deal size.",
      "My deals, the owner and the close date filters apply to the cards, the board and the table alike.",
      "Each board column shows how many deals it has and their value in the company's currency; open stages also show the weighted value. Cancelled deals stay in their column but aren't counted.",
      "When CRM Settings shows sales people only their own, you see the deals you own and the unassigned ones; CRM admins see all.",
      "Money on the cards is in the company's currency: a deal in another currency counts at the latest exchange rate in Finance. One whose currency has no rate yet is named under the cards and left out.",
      "Reopening a Won or Lost deal clears its closing day and lost reason.",
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
      {
        title: "Close the open tasks and plan the next follow-up",
        steps: [
          "After you add an interaction, a Follow up window opens.",
          "Under Open tasks, the lead's or customer's pending tasks are ticked: untick any the conversation didn't settle.",
          "Under Plan the next follow-up, change the title, type and date if you like (a call a week ahead at 10:00 is suggested), or untick it.",
          "Click Save to mark the ticked tasks done and add the new task, or Skip to leave everything as it is.",
        ],
      },
      { title: "Read the notes", steps: ["Click View Notes on a row."] },
    ],
    rules: [
      "Type, subject and date are required.",
      "The cards count all communications and the emails, calls and meetings.",
      "The new follow-up task is assigned to you and shows on Tasks; you get its reminder before it's due.",
      "An interaction counts as a follow-up: it closes the \"No follow-up\" bell alert on the lead or on the customer's open deals.",
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
      { name: "Weighted", meaning: "Under Pipeline: each open deal's amount × its probability, added up — what the pipeline is likely to bring." },
    ],
    rules: [
      "When CRM Settings shows sales people only their own, the figures and exports count only the leads, deals, tasks and interactions you can see.",
      "Money is in the company's currency: each deal at the latest exchange rate in Finance. Deals in a currency without a rate are left out and counted under Pipeline (\"not converted\"; hover to see them).",
    ],
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
      "Your company's own CRM rules: whether sales people see everyone's leads and deals or only their own, the lists of lead sources and lost reasons, each stage's win probability and when owners are reminded to follow up.",
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
      {
        title: "Set the win probability of each stage",
        steps: [
          "Under Win probability by stage, enter a percentage for Prospecting, Qualified and Negotiation.",
          "Click Save. Deals take the new value when they next move to that stage; deals already there keep theirs.",
        ],
        who: "CRM admin",
      },
      {
        title: "Take enquiries from your website",
        steps: [
          "Under Website form, choose who the leads go to (or Unassigned) and click Switch on.",
          "Copy the HTML to paste on your website and give it to whoever looks after the site (or use the Form address in your own form).",
          "Each enquiry becomes a New lead with source Website; its owner gets a bell alert.",
          "Under Privacy notice and consent, write the text by the tick box and your privacy policy's address; the lead keeps what the person agreed to and when.",
          "Make a new key if the address is being misused; Switch off stops the form.",
        ],
        who: "CRM admin",
      },
      {
        title: "Choose when owners are reminded to follow up",
        steps: [
          "Under Follow-up reminders, enter the days without a task or interaction (14 to start with).",
          "Click Save. Enter 0 to turn these reminders off.",
        ],
        who: "CRM admin",
      },
      {
        title: "Decide what happens to deals for customers who owe too much",
        steps: [
          "Under Credit check on deals, choose Warn (the default), Block until finance releases the deal, or Nothing.",
          "Enter how many days an invoice may be overdue (30 to start with; 0 counts any overdue invoice) and click Save.",
          "Deals then show a chip when their customer is over its credit limit or overdue too long, and moving one to Negotiation or Won warns or is blocked.",
          "A blocked deal's owner clicks Ask finance to release; someone with the sales, finance or CRM approval right releases it with a reason.",
          "A release lasts 30 days, and only while the customer owes no more than it did then; after that the deal is checked again. Accepting the deal's quotation (which marks it Won) is checked the same way.",
          "Only people who may view finance see the amounts owed, the open invoices and the cheques; others see the warning and how many days late.",
        ],
        who: "CRM admin",
      },
    ],
    fields: [
      { name: "Owner", meaning: "The login responsible for a lead or deal; set on Leads and Deals." },
      { name: "Lead sources", meaning: "The Source choices on a lead (Walk-in, Website, Exhibition…)." },
      { name: "Lost reasons", meaning: "The reasons offered when a lead or deal is set to Lost (Price, Lost to competitor…)." },
      { name: "Win probability by stage", meaning: "Each open stage's default probability: Prospecting 10%, Qualified 25%, Negotiation 60% until you change them; Won is always 100% and Lost 0%." },
      {
        name: "Follow-up reminders",
        meaning:
          "The owner of a lead still open, or of an open deal, gets a bell alert after this many days with no task or interaction and nothing planned ahead. A deal's tasks and interactions are those on its lead or customer. The alert closes by itself once something is done.",
      },
      {
        name: "Website form",
        meaning:
          "Name (required), email or phone (one is required), company, job title, country, city, interest and message. A hidden field catches spam robots; one address can send 5 enquiries an hour and the form 200. Only CRM admins see this card.",
      },
    ],
    rules: [
      "CRM admins and Tenant Admins always see everything.",
      "Unassigned leads and deals stay visible to everyone, so anyone can take one by making themselves its owner.",
      "Tasks and interactions about a customer only stay visible to everyone: customers are shared by the whole company.",
      "A lead or deal you can't see can't be opened, edited or linked to a task, interaction or deal.",
      "Leads and deals added before owners existed are unassigned until someone becomes their owner.",
      "A list keeps at least one entry and up to 30, each up to 50 characters. Removing an entry doesn't change the leads and deals that already have it.",
    ],
    related: [
      { route: "/leads", label: "Leads" },
      { route: "/opportunities", label: "Deals" },
      { route: "/rolesPermissions", label: "Roles & Permissions", why: "Who has the CRM admin right." },
    ],
  },
];
