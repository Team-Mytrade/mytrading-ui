import type { HelpFlow, HelpRegion, HelpTopic } from "./types";

// Help by country (India or the Gulf), plain data functions (no React: scripts/check-help-*.cjs load these files).
// A page's help can say things only for one region (HelpTopic.byRegion), a page can be only for one region
// (HelpTopic.regions) and so can a flow step. Which region applies is decided in region.ts.

export const HELP_REGIONS: HelpRegion[] = ["IN", "GCC"];

/** How a region is named on screen (through t()). */
export const REGION_NAME: Record<HelpRegion, string> = { IN: "India", GCC: "Gulf (GCC)" };

/** Whether the page is meant for companies in the region (pages without regions are for everyone). */
export const topicForRegion = (topic: HelpTopic, region: HelpRegion) => !topic.regions || topic.regions.includes(region);

/** Whether anything in the topic depends on the region. */
export const topicVaries = (topic: HelpTopic) => Boolean(topic.regions?.length || (topic.byRegion && Object.keys(topic.byRegion).length));

const add = <T,>(base: T[] | undefined, extra: T[] | undefined): T[] | undefined =>
  extra?.length ? [...(base ?? []), ...extra] : base;

/** The topic as a company in the region reads it: its own text with the region's part put in. */
export const regionalTopic = (topic: HelpTopic, region: HelpRegion): HelpTopic => {
  const part = topic.byRegion?.[region];
  if (!part) return topic;
  return {
    ...topic,
    title: part.title ?? topic.title,
    summary: part.summary ?? topic.summary,
    who: part.who ?? topic.who,
    tasks: add(topic.tasks, part.tasks) ?? [],
    fields: add(topic.fields, part.fields),
    statuses: add(topic.statuses, part.statuses),
    rules: add(topic.rules, part.rules),
    related: add(topic.related, part.related),
    // Resolved: the other regions' parts aren't carried along
    byRegion: undefined,
  };
};

/** The flow without the steps other regions take. */
export const regionalFlow = (flow: HelpFlow, region: HelpRegion): HelpFlow =>
  flow.steps.some((s) => s.regions) ? { ...flow, steps: flow.steps.filter((s) => !s.regions || s.regions.includes(region)) } : flow;
