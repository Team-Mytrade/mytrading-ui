import type { HelpExample } from "../types";

// Examples for CRM (topics/crm.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data).
export const CRM_EXAMPLES: Record<string, HelpExample> = {
  leads: {
    story: "A buyer from a new coworking chain calls asking about 40 laptops; Maria D'Souza records the lead.",
    data: [
      { label: "Lead name", value: "Hive Coworking Spaces" },
      { label: "Contact", value: "Sameer Qureshi" },
      { label: "Email", value: "sameer@hive-cowork.test" },
      { label: "Phone", value: "+971 50 412 7781" },
      { label: "Status", value: "New → Contacted → Qualified" },
    ],
    result: "Once qualified, Maria converts it: Hive Coworking Spaces becomes a customer ready for a quotation.",
  },
  deals: {
    story: "Maria opens a deal for Hive's laptop order to follow it through the pipeline.",
    data: [
      { label: "Deal", value: "Hive – 40 ThinkPads for new branch" },
      { label: "Customer", value: "Hive Coworking Spaces" },
      { label: "Value", value: "AED 147,960" },
      { label: "Stage", value: "Proposal" },
      { label: "Expected close", value: "30 Nov 2026" },
    ],
    result: "From the deal she makes a quotation with 40 × Lenovo ThinkPad E14 at AED 3,699.",
  },
  "crm-tasks": {
    story: "After sending the quotation, Maria plans a follow-up call.",
    data: [
      { label: "Task", value: "Call Sameer about the ThinkPad quotation" },
      { label: "Due", value: "18 Nov 2026, 11:00" },
      { label: "Assigned to", value: "Maria D'Souza" },
      { label: "Linked to", value: "Deal: Hive – 40 ThinkPads" },
    ],
    result: "The task shows on her list and Command Center; she closes it after the call.",
  },
  "crm-interactions": {
    story: "Maria records what was agreed on the call.",
    data: [
      { label: "Type", value: "Call" },
      { label: "Customer", value: "Hive Coworking Spaces" },
      { label: "Subject", value: "Quotation QT-2026-0042 follow-up" },
      { label: "Notes", value: "Wants 2-week delivery; asks for 3% discount on 40 units." },
    ],
    result: "Anyone opening Hive's history sees the discount request before calling them.",
  },
  "key-contacts": {
    story: "Sales adds the person who approves payments at Smart Office Solutions.",
    data: [
      { label: "Customer", value: "Smart Office Solutions FZE" },
      { label: "Name", value: "Lina Haddad" },
      { label: "Role", value: "Finance Manager" },
      { label: "Email", value: "lina.haddad@smartoffice.test" },
    ],
    result: "Finance knows exactly who to call when an invoice is overdue.",
  },
  segments: {
    story: "Marketing groups the retail shops to send them a festive offer.",
    data: [
      { label: "Segment", value: "Retail shops – Dubai" },
      { label: "Customers", value: "Al Noor Electronics Retail, Emirates IT Mart, Creek Side Computers" },
    ],
    result: "Price lists and reports can target the three shops together.",
  },
  "crm-reports": {
    story: "Ahmed reviews the month's pipeline before the sales meeting.",
    data: [
      { label: "Open deals", value: "9 · AED 612,400" },
      { label: "Won this month", value: "4 · AED 198,300" },
      { label: "Lost", value: "2 (price)" },
      { label: "Leads converted", value: "3 of 7" },
    ],
    result: "He exports the open deals to Excel for the meeting.",
  },
};
