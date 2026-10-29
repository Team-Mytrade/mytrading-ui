// Screen language. Texts are looked up by their English wording (t("Invoices") → "الفواتير"), so a phrase with no
// translation yet simply stays English. The language is the user's own choice on this browser, else the company's
// (Company Settings → Regional settings → Language). Right-to-left languages turn the whole page around (dir="rtl");
// Tailwind's left/right utilities are emitted as start/end (tailwind.logical.js), so layouts mirror by themselves.
import { useSyncExternalStore } from "react";
import { ar } from "./ar";

export type Language = "en" | "ar";

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];

const DICTIONARIES: Partial<Record<Language, Record<string, string>>> = { ar };
const RIGHT_TO_LEFT = new Set<Language>(["ar"]);
const STORAGE_KEY = "app-language";
const CHANGED = "app-language-changed";

const supported = (value?: string | null): Language | null =>
  value === "en" || value === "ar" ? value : null;

const readChoice = (): Language | null => {
  try {
    return supported(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

let companyLanguage: Language = "en";
let current: Language = readChoice() ?? companyLanguage;

const apply = () => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = current;
  document.documentElement.dir = RIGHT_TO_LEFT.has(current) ? "rtl" : "ltr";
};
apply();

const change = (next: Language) => {
  if (next === current) return;
  current = next;
  apply();
  window.dispatchEvent(new Event(CHANGED));
};

export const language = (): Language => current;

export const isRightToLeft = (): boolean => RIGHT_TO_LEFT.has(current);

/** The user's choice on this browser (null: following the company's language). */
export const languageChoice = (): Language | null => readChoice();

/** Chosen by the user: kept on this browser and used instead of the company's language. */
export const setLanguage = (next: Language) => {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode: the choice lasts until the page is reloaded
  }
  change(next);
};

/** The company's language (from its regional settings), used when the user hasn't chosen one. */
export const setCompanyLanguage = (value?: string | null) => {
  companyLanguage = supported(value) ?? "en";
  if (!readChoice()) change(companyLanguage);
};

/**
 * The text in the current language, looked up by its English wording; {name} placeholders are filled from vars.
 * Untranslated text comes back as it is.
 */
export const t = (text: string, vars?: Record<string, string | number>): string => {
  if (!text || typeof text !== "string") return text;
  const dictionary = DICTIONARIES[current];
  const translated = dictionary ? dictionary[text] ?? lowerCased(current, dictionary).get(text.trim().toLowerCase()) ?? text : text;
  return vars ? translated.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : translated;
};

// "Partially paid" finds "Partially Paid": labels are written in different cases across the screens
const lowerIndex = new Map<Language, Map<string, string>>();
const lowerCased = (lang: Language, dictionary: Record<string, string>) => {
  let index = lowerIndex.get(lang);
  if (!index) {
    index = new Map(Object.entries(dictionary).map(([key, value]) => [key.toLowerCase(), value]));
    lowerIndex.set(lang, index);
  }
  return index;
};

/** For texts that may not be strings (React nodes pass through untouched). */
export const tNode = <T,>(value: T): T => (typeof value === "string" ? (t(value) as unknown as T) : value);

const subscribe = (listener: () => void) => {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
};

/** The current language; the component renders again when it changes. */
export const useLanguage = (): Language => useSyncExternalStore(subscribe, language, () => "en" as Language);
