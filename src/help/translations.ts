import { useSyncExternalStore } from "react";
import { language, useLanguage, type Language } from "../i18n/i18n";
import type { HelpExample, HelpFlow, HelpFlowExample, HelpTopic } from "./types";

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
}

export interface FlowText {
  title?: string;
  summary?: string;
  steps?: { title?: string; who?: string; detail?: string }[];
}

/** A topic's example: the story, the data labels (values stay as they are) and the result. */
export interface ExampleText {
  story?: string;
  labels?: string[];
  result?: string;
}

/** A flow's example: the story and one line per step. */
export interface FlowExampleText {
  story?: string;
  steps?: string[];
}

export interface HelpTranslation {
  topics: Record<string, TopicText>;
  flows: Record<string, FlowText>;
  examples?: Record<string, ExampleText>;
  flowExamples?: Record<string, FlowExampleText>;
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

/** The topic in the translation's language, and whether it was translated. */
export const localizeTopic = (topic: HelpTopic, translation: HelpTranslation | null): { topic: HelpTopic; translated: boolean } => {
  const text = translation?.topics[topic.id];
  if (!text) return { topic, translated: false };
  return {
    translated: true,
    topic: {
      ...topic,
      title: pick(topic.title, text.title),
      summary: pick(topic.summary, text.summary),
      who: over(topic.who, text.who, (e, t) => ({ role: pick(e.role, t.role), can: pick(e.can, t.can) }))!,
      tasks: over(topic.tasks, text.tasks, (e, t) => ({
        ...e,
        title: pick(e.title, t.title),
        steps: e.steps.map((s, i) => pick(s, t.steps?.[i])),
        who: e.who ? pick(e.who, t.who) : e.who,
      }))!,
      fields: over(topic.fields, text.fields, (e, t) => ({ name: pick(e.name, t.name), meaning: pick(e.meaning, t.meaning) })),
      statuses: over(topic.statuses, text.statuses, (e, t) => ({ name: pick(e.name, t.name), meaning: pick(e.meaning, t.meaning) })),
      rules: topic.rules?.map((r, i) => pick(r, text.rules?.[i])),
      related: over(topic.related, text.related, (e, t) => ({ ...e, label: pick(e.label, t.label), why: e.why ? pick(e.why, t.why) : e.why })),
    },
  };
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

/** A topic's example in the translation's language (labels translated, values kept), and whether it was translated. */
export const localizeExample = (id: string, example: HelpExample, translation: HelpTranslation | null): { example: HelpExample; translated: boolean } => {
  const text = translation?.examples?.[id];
  if (!text) return { example, translated: false };
  return {
    translated: true,
    example: {
      ...example,
      story: pick(example.story, text.story),
      data: example.data?.map((d, i) => ({ ...d, label: pick(d.label, text.labels?.[i]) })),
      result: example.result ? pick(example.result, text.result) : example.result,
    },
  };
};

/** A flow's example in the translation's language, and whether it was translated. */
export const localizeFlowExample = (id: string, example: HelpFlowExample, translation: HelpTranslation | null): { example: HelpFlowExample; translated: boolean } => {
  const text = translation?.flowExamples?.[id];
  if (!text) return { example, translated: false };
  return {
    translated: true,
    example: { ...example, story: pick(example.story, text.story), steps: example.steps.map((s, i) => pick(s, text.steps?.[i])) },
  };
};

/** dir / lang for help text: the screen's language when translated, else English left to right. */
export const textDirection = (translated: boolean) =>
  translated ? { dir: language() === "ar" ? "rtl" : "ltr", lang: language() } : { dir: "ltr", lang: "en" };
