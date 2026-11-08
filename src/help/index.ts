import type { HelpFlow, HelpTopic } from "./types";
import { COMMON_TOPICS } from "./topics/common";
import { CRM_TOPICS } from "./topics/crm";
import { SALES_TOPICS } from "./topics/sales";
import { PURCHASE_TOPICS } from "./topics/purchase";
import { INVENTORY_TOPICS } from "./topics/inventory";
import { DELIVERY_TOPICS } from "./topics/delivery";
import { INVOICE_TOPICS } from "./topics/invoice";
import { HR_TOPICS } from "./topics/hr";
import { ATTENDANCE_TOPICS } from "./topics/attendance";
import { HELP_FLOWS } from "./flows";

export type { HelpFlow, HelpTopic } from "./types";

/** Every page's help, in menu order. Modules are added one by one (backlog 8.1). */
export const HELP_TOPICS: HelpTopic[] = [...COMMON_TOPICS, ...CRM_TOPICS, ...SALES_TOPICS, ...PURCHASE_TOPICS, ...INVENTORY_TOPICS, ...DELIVERY_TOPICS, ...INVOICE_TOPICS, ...HR_TOPICS, ...ATTENDANCE_TOPICS];

export { HELP_FLOWS };

/** The modules in menu order, for the Help Center. */
export const HELP_MODULES: string[] = [...new Set(HELP_TOPICS.map((t) => t.module))];

const routesOf = (topic: HelpTopic) => [topic.route, ...(topic.aliases ?? [])];

const matches = (route: string, pathname: string): boolean => {
  if (route === "/") return pathname === "/";
  // A route with parameters (/x/:id) matches any value in that place
  if (route.includes(":")) {
    const pattern = new RegExp(`^${route.replace(/:[^/]+/g, "[^/]+")}(/.*)?$`);
    return pattern.test(pathname);
  }
  // The page itself, or a page under it (detail, edit, create)
  return pathname === route || pathname.startsWith(`${route}/`);
};

/** The help for the page at this path (the longest matching route wins), or null. */
export const findHelpTopic = (pathname: string): HelpTopic | null => {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: HelpTopic | null = null;
  let bestLength = -1;
  for (const topic of HELP_TOPICS) {
    for (const route of routesOf(topic)) {
      if (matches(route, path) && route.length > bestLength) {
        best = topic;
        bestLength = route.length;
      }
    }
  }
  return best;
};

export const helpTopicById = (id: string): HelpTopic | null => HELP_TOPICS.find((t) => t.id === id) ?? null;
export const helpFlowById = (id: string): HelpFlow | null => HELP_FLOWS.find((f) => f.id === id) ?? null;

/** Every word of the query somewhere in the topic (title, summary, tasks, fields, statuses, rules). */
export const searchHelp = (query: string): { topics: HelpTopic[]; flows: HelpFlow[] } => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { topics: HELP_TOPICS, flows: HELP_FLOWS };
  const topicText = (t: HelpTopic) =>
    [t.title, t.module, t.summary, ...t.tasks.flatMap((k) => [k.title, ...k.steps]), ...(t.fields ?? []).flatMap((f) => [f.name, f.meaning]),
      ...(t.statuses ?? []).flatMap((s) => [s.name, s.meaning]), ...(t.rules ?? [])].join(" ").toLowerCase();
  const flowText = (f: HelpFlow) => [f.title, f.summary, ...f.steps.flatMap((s) => [s.title, s.detail])].join(" ").toLowerCase();
  return {
    topics: HELP_TOPICS.filter((t) => words.every((w) => topicText(t).includes(w))),
    flows: HELP_FLOWS.filter((f) => words.every((w) => flowText(f).includes(w))),
  };
};
