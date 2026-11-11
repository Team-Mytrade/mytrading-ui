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

/**
 * Which country rules the help is written for, from the company's country (Company Settings), as the menu and the
 * payroll pages decide it: India, or the Gulf (UAE, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait).
 */
export type HelpRegion = "IN" | "GCC";

/**
 * What a page's help says only for one region. Title, summary and who replace the topic's own; tasks, fields,
 * statuses, rules and related pages are added after the topic's own (which hold what is true everywhere).
 */
export interface HelpRegionPart {
  title?: string;
  summary?: string;
  who?: HelpRole[];
  tasks?: HelpTask[];
  fields?: HelpTerm[];
  statuses?: HelpTerm[];
  rules?: string[];
  related?: HelpLink[];
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
  /** The page is only for companies in these regions: the Help Center lists it only for them. */
  regions?: HelpRegion[];
  /** What differs by region (see HelpRegionPart). */
  byRegion?: Partial<Record<HelpRegion, HelpRegionPart>>;
}

export interface HelpFlowStep {
  title: string;
  route?: string;
  who?: string;
  detail: string;
  /** A step only companies in these regions take. */
  regions?: HelpRegion[];
}

/** An end-to-end business flow across pages (the user manual). */
export interface HelpFlow {
  id: string;
  title: string;
  summary: string;
  steps: HelpFlowStep[];
}
