// Help for every page (backlog 8.1): one topic per page, written for the people who use it.
// Content is English for now; the help chrome (buttons, headings) goes through t() like the rest of the UI.

/** Who may do what on a page, in the words of the demo roles: Admin, Manager, Executive, Everyone. */
export interface HelpRole {
  role: string;
  can: string;
}

/** A job on the page, as numbered steps. */
export interface HelpTask {
  title: string;
  steps: string[];
  /** Who usually does it, when it is not everyone who can open the page. */
  who?: string;
}

/** A field, a status or a column: its name as on screen and what it means. */
export interface HelpTerm {
  name: string;
  meaning: string;
}

export interface HelpLink {
  route: string;
  label: string;
  why?: string;
}

export interface HelpTopic {
  /** Stable id, used in Help Center links (/help/<id>). */
  id: string;
  /** The page's route as in the menu. Detail and edit pages under it (e.g. /quotations/12) get the same help. */
  route: string;
  /** Other routes that show this page (old paths, create/edit pages with their own route). */
  aliases?: string[];
  title: string;
  /** Menu module: Common, CRM, Sales, Purchase, Inventory, Delivery, Invoice, HRMS, Attendance, Reports, Settings… */
  module: string;
  /** What the page is for, in one or two sentences. */
  summary: string;
  who: HelpRole[];
  tasks: HelpTask[];
  fields?: HelpTerm[];
  statuses?: HelpTerm[];
  /** Rules the page enforces, and tips. */
  rules?: string[];
  related?: HelpLink[];
  /** Ids of the end-to-end flows this page is part of. */
  flows?: string[];
}

export interface HelpFlowStep {
  title: string;
  route?: string;
  who?: string;
  detail: string;
}

/** The demo companies the examples use (tools/demo-data): Gulf Electronics (UAE), Al Bina (Saudi), Speedline (India). */
export type SampleCompany = "GET" | "ABM" | "SAP";

/** A worked example with sample business data: what someone at a demo company enters and what happens. */
export interface HelpExample {
  /** Defaults to Gulf Electronics Trading LLC. */
  company?: SampleCompany;
  /** One or two sentences: who does what. */
  story: string;
  /** What they enter or see, label and value as on screen. Values are data (names, codes, amounts) and stay as they
   *  are in every language; only labels are translated. */
  data?: { label: string; value: string }[];
  /** What happens next. */
  result?: string;
}

/** A flow followed with one sample case: a line of sample data for each step, in step order. */
export interface HelpFlowExample {
  company?: SampleCompany;
  story: string;
  steps: string[];
}

/** An end-to-end business flow across pages (the user manual). */
export interface HelpFlow {
  id: string;
  title: string;
  summary: string;
  steps: HelpFlowStep[];
}
