import { useSyncExternalStore } from "react";
import { language, useLanguage, type Language } from "../i18n/i18n";
import type { HelpFlow, HelpRegion, HelpRegionPart, HelpTopic } from "./types";
import { regionalFlow, regionalTopic } from "./regionText";

// Help in other languages (backlog 8.1.8). Each language has files that mirror the English topics and flows by id,
// field by field and item by item (the same order). They are loaded only when the screen is in that language, so the
// English-only bundle stays as it is. Anything not translated stays English. scripts/check-help-arabic.cjs checks
// that every topic and flow has its translation and that each one still has the shape of its English.

export interface TopicText {
  title?: string;
  summary?: string;
  who?: { role?: string; can?: string }[];
  tasks?: { title?: string; steps?: string[]; who?: string }[];
  fields?: { name?: string; meaning?: string }[];
  statuses?: { name?: string; meaning?: string }[];
  rules?: string[];
  related?: { label?: string; why?: string }[];
  /** The region parts (HelpTopic.byRegion), mirrored the same way. */
  byRegion?: Partial<Record<HelpRegion, TopicText>>;
}

export interface FlowText {
  title?: string;
  summary?: string;
  steps?: { title?: string; who?: string; detail?: string }[];
}

export interface HelpTranslation {
  topics: Record<string, TopicText>;
  flows: Record<string, FlowText>;
}

const LOADERS: Partial<Record<Language, () => Promise<HelpTranslation>>> = {
  ar: () => import("./ar").then((m) => m.AR_HELP),
};

const loaded: Partial<Record<Language, HelpTranslation>> = {};
const pending = new Set<Language>();
const LOADED = "help-translation-loaded";

const load = (lang: Language) => {
  const loader = LOADERS[lang];
  if (!loader || loaded[lang] || pending.has(lang)) return;
  pending.add(lang);
  loader()
    .then((translation) => {
      loaded[lang] = translation;
      window.dispatchEvent(new Event(LOADED));
    })
    .catch(() => {
      // Offline or a failed chunk: the help stays English; the next language change tries again
    })
    .finally(() => pending.delete(lang));
};

const subscribe = (listener: () => void) => {
  window.addEventListener(LOADED, listener);
  return () => window.removeEventListener(LOADED, listener);
};

const current = (): HelpTranslation | null => {
  const lang = language();
  if (lang === "en") return null;
  load(lang);
  return loaded[lang] ?? null;
};

/** The help translation for the screen language (null for English, or while it is still loading). */
export const useHelpTranslation = (): HelpTranslation | null => {
  useLanguage();
  return useSyncExternalStore(subscribe, current, () => null);
};

// Item i of the translation over item i of the English; a missing or empty text keeps the English
const pick = (english: string, translated?: string) => (translated && translated.trim() ? translated : english);
const over = <E, T>(english: E[] | undefined, translated: T[] | undefined, merge: (e: E, t: T) => E): E[] | undefined =>
  english && translated ? english.map((item, i) => (translated[i] ? merge(item, translated[i]) : item)) : english;

// A topic's texts, or one of its region parts, over the English
const localizePart = <P extends HelpRegionPart>(english: P, text: TopicText): P => ({
  ...english,
  title: english.title === undefined ? undefined : pick(english.title, text.title),
  summary: english.summary === undefined ? undefined : pick(english.summary, text.summary),
  who: over(english.who, text.who, (e, t) => ({ role: pick(e.role, t.role), can: pick(e.can, t.can) })),
  tasks: over(english.tasks, text.tasks, (e, t) => ({
    ...e,
    title: pick(e.title, t.title),
    steps: e.steps.map((s, i) => pick(s, t.steps?.[i])),
    who: e.who ? pick(e.who, t.who) : e.who,
  })),
  fields: over(english.fields, text.fields, (e, t) => ({ name: pick(e.name, t.name), meaning: pick(e.meaning, t.meaning) })),
  statuses: over(english.statuses, text.statuses, (e, t) => ({ name: pick(e.name, t.name), meaning: pick(e.meaning, t.meaning) })),
  rules: english.rules?.map((r, i) => pick(r, text.rules?.[i])),
  related: over(english.related, text.related, (e, t) => ({ ...e, label: pick(e.label, t.label), why: e.why ? pick(e.why, t.why) : e.why })),
}) as P;

/** The topic in the translation's language, and whether it was translated (all regions' parts included). */
export const localizeTopic = (topic: HelpTopic, translation: HelpTranslation | null): { topic: HelpTopic; translated: boolean } => {
  const text = translation?.topics[topic.id];
  if (!text) return { topic, translated: false };
  const byRegion = topic.byRegion
    ? Object.fromEntries(Object.entries(topic.byRegion).map(([region, part]) => {
        const regionText = text.byRegion?.[region as HelpRegion];
        return [region, part && regionText ? localizePart(part, regionText) : part];
      }))
    : undefined;
  return { translated: true, topic: { ...localizePart(topic, text), byRegion } };
};

/** The topic as shown: in the screen's language and for the region. */
export const shownTopic = (topic: HelpTopic, translation: HelpTranslation | null, region: HelpRegion) => {
  const { topic: localized, translated } = localizeTopic(topic, translation);
  return { topic: regionalTopic(localized, region), translated };
};

/** The flow in the translation's language, and whether it was translated. */
export const localizeFlow = (flow: HelpFlow, translation: HelpTranslation | null): { flow: HelpFlow; translated: boolean } => {
  const text = translation?.flows[flow.id];
  if (!text) return { flow, translated: false };
  return {
    translated: true,
    flow: {
      ...flow,
      title: pick(flow.title, text.title),
      summary: pick(flow.summary, text.summary),
      steps: flow.steps.map((s, i) => {
        const t = text.steps?.[i];
        return t ? { ...s, title: pick(s.title, t.title), who: s.who ? pick(s.who, t.who) : s.who, detail: pick(s.detail, t.detail) } : s;
      }),
    },
  };
};

/** The flow as shown: in the screen's language, without other regions' steps. */
export const shownFlow = (flow: HelpFlow, translation: HelpTranslation | null, region: HelpRegion) => {
  const { flow: localized, translated } = localizeFlow(flow, translation);
  return { flow: regionalFlow(localized, region), translated };
};

/** dir / lang for help text: the screen's language when translated, else English left to right. */
export const textDirection = (translated: boolean) =>
  translated ? { dir: language() === "ar" ? "rtl" : "ltr", lang: language() } : { dir: "ltr", lang: "en" };
