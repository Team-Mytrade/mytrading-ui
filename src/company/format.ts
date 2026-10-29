// Formatting by the company's regional settings (Company Settings → Regional settings): money, numbers,
// dates and times. Plain functions, so tables, exports and PDFs use them as well as pages.
// The settings are set when the company profile loads (companyApi); until then today's defaults apply.
import { DEFAULT_REGIONAL, RegionalSettings, currencyDigits } from "./regional";
import { language, setCompanyLanguage } from "../i18n/i18n";

let regional: RegionalSettings = DEFAULT_REGIONAL;

const CHANGED = "app-regional-changed";

/** Called by companyApi with each loaded or saved profile; null (no profile) restores the defaults. */
export const setRegional = (settings: Partial<RegionalSettings> | null) => {
  const next: RegionalSettings = { ...DEFAULT_REGIONAL };
  if (settings) {
    (Object.keys(DEFAULT_REGIONAL) as (keyof RegionalSettings)[]).forEach((key) => {
      const value = settings[key];
      if (value !== null && value !== undefined && value !== "") (next as unknown as Record<string, unknown>)[key] = value;
    });
  }
  // The screens' language follows the company's unless the user picked one
  setCompanyLanguage(next.language);
  if (JSON.stringify(next) === JSON.stringify(regional)) return;
  regional = next;
  numberFormats.clear();
  window.dispatchEvent(new Event(CHANGED));
};

export const getRegional = (): RegionalSettings => regional;

/** Re-renders a component when the settings change (e.g. saved in Company Settings). */
export const onRegionalChange = (listener: () => void) => {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
};

/** The company's currency code (AED, INR, ...). */
export const companyCurrency = () => regional.currency;

const COMMON_CURRENCIES = ["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "CHF", "CNY", "JPY"];

/** Currencies for document pick-lists: the company's first, then Gulf, INR and major currencies (plus `keep`, e.g. a stored value). */
export const currencyChoices = (...keep: (string | null | undefined)[]): string[] =>
  Array.from(new Set([regional.currency, ...COMMON_CURRENCIES, ...keep.filter((c): c is string => !!c).map((c) => c.toUpperCase())]));

/* ================= Numbers & money ================= */

const numberFormats = new Map<string, Intl.NumberFormat>();

const numberFormat = (key: string, options: Intl.NumberFormatOptions) => {
  let format = numberFormats.get(key);
  if (!format) {
    try {
      format = new Intl.NumberFormat(regional.numberLocale, options);
    } catch {
      // Unknown currency code on a document: show the number with the code in front
      format = new Intl.NumberFormat(regional.numberLocale, {
        minimumFractionDigits: options.minimumFractionDigits,
        maximumFractionDigits: options.maximumFractionDigits,
      });
    }
    numberFormats.set(key, format);
  }
  return format;
};

const toNumber = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// The company's money decimals for its own currency, the currency's usual decimals for others
const decimalsFor = (currency: string) =>
  currency === regional.currency ? regional.currencyDecimals : currencyDigits(currency);

export interface MoneyOptions {
  /** Document currency; the company's by default. */
  currency?: string | null;
  /** Whole units (dashboards, cards). */
  whole?: boolean;
  /** 1.2K / 3.4M style (charts, KPI tiles). */
  compact?: boolean;
}

/**
 * An amount with its currency: ₹1,23,456.00 for INR, AED 1,234.50, KWD 12.345.
 * Symbols are used where they are unambiguous (₹, $, €, £); Gulf currencies show their code.
 */
export const formatMoney = (value: unknown, options: MoneyOptions | string = {}): string => {
  const opts: MoneyOptions = typeof options === "string" ? { currency: options } : options;
  const currency = (opts.currency || regional.currency).toUpperCase();
  const decimals = opts.compact ? 1 : opts.whole ? 0 : decimalsFor(currency);
  const key = `m|${currency}|${decimals}|${opts.compact ? "c" : ""}`;
  const format = numberFormat(key, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: opts.compact ? 0 : decimals,
    maximumFractionDigits: decimals,
    notation: opts.compact ? "compact" : "standard",
  });
  const text = format.format(toNumber(value));
  // Fallback format has no currency in it
  return format.resolvedOptions().style === "currency" ? text : `${currency} ${text}`;
};

/** Decimals for amounts in a currency (the company's setting for its own currency): KWD 3, INR 2, JPY 0. */
export const moneyDecimals = (currency?: string | null): number => decimalsFor((currency || regional.currency).toUpperCase());

/** An amount without the currency (table cells under a currency header, inputs' read-only totals). */
export const formatAmount = (value: unknown, currency?: string | null): string => {
  const decimals = decimalsFor((currency || regional.currency).toUpperCase());
  return numberFormat(`a|${decimals}`, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .format(toNumber(value));
};

/** A quantity or count in the company's number style; up to `maxDecimals` decimals (default 2). */
export const formatNumber = (value: unknown, maxDecimals = 2): string =>
  numberFormat(`n|${maxDecimals}`, { maximumFractionDigits: maxDecimals }).format(toNumber(value));

/** Rounds an amount to the currency's decimals (for totals computed in the browser). */
export const roundMoney = (value: unknown, currency?: string | null): number => {
  const factor = 10 ** decimalsFor((currency || regional.currency).toUpperCase());
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
};

/**
 * Text for jsPDF's built-in fonts, which only have Latin-1 characters: ₹ prints as "Rs.", other
 * symbols outside it (₩, ₪, ...) as nothing, and Intl's narrow/no-break spaces as plain spaces.
 */
export const pdfText = (text: string): string =>
  text
    .replace(/₹\s?/g, "Rs. ")
    .replace(/[   ]/g, " ")
    .replace(/[^\u0000-ÿ€]/g, "");

/* ================= Dates & times ================= */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// A date-time without an offset (Java LocalDateTime): already the wall-clock time to show
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Gulf usage: Gregorian month names (Arabic has no separate short form); digits stay 0–9
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** Month names (January first) in the screen language. */
export const monthNames = (style: "short" | "long" = "short"): string[] =>
  language() === "ar" ? [...MONTHS_AR] : style === "long" ? [...MONTHS_LONG] : [...MONTHS];

const monthName = (month: number) => monthNames("short")[month - 1];
/**
 * A month-name array that always reads in the current screen language (for module-level constants that
 * pages index or map over; the language can change after they are created).
 */
export const liveMonthNames = (style: "short" | "long" = "short"): string[] =>
  new Proxy([] as string[], { get: (_target, key) => Reflect.get(monthNames(style), key) });

/**
 * Locale for the browser's own date formatting (toLocaleDateString, Intl.DateTimeFormat) in the screen language:
 * Arabic names with Western digits, else the given English locale (undefined = the browser's).
 */
export const dateLocale = (english?: string): string | undefined => (language() === "ar" ? "ar-AE-u-nu-latn" : english);

// Parts of an instant in the company's time zone
const zonedParts = (date: Date): Parts => {
  const parts: Record<string, string> = {};
  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: regional.timeZone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).forEach((p) => (parts[p.type] = p.value));
  } catch {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes() };
  }
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour % 24, minute: +parts.minute };
};

/** Date and time parts to show, or null when the value isn't a date. */
const partsOf = (value: unknown): Parts | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const text = value.trim();
    const d = DATE_ONLY.exec(text);
    if (d) return { year: +d[1], month: +d[2], day: +d[3], hour: 0, minute: 0 };
    const l = LOCAL_DATE_TIME.exec(text);
    if (l) return { year: +l[1], month: +l[2], day: +l[3], hour: +l[4], minute: +l[5] };
  }
  // Date objects in the UI are mostly built from calendar parts (new Date(y, m, d)): show their wall time,
  // so a picked day never moves to the day before in a zone west of the browser
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null
      : { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate(), hour: value.getHours(), minute: value.getMinutes() };
  }
  // Instants (ISO with Z or an offset, epoch millis) are shown in the company's time zone
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : zonedParts(date);
};

const pad = (n: number) => String(n).padStart(2, "0");

const datePattern = (p: Parts, pattern: string) =>
  pattern
    .replace("yyyy", String(p.year))
    .replace("MMM", monthName(p.month))
    .replace("MM", pad(p.month))
    .replace("dd", pad(p.day));

const timeText = (p: Parts) => {
  if (regional.timeFormat === "24h") return `${pad(p.hour)}:${pad(p.minute)}`;
  const hour = p.hour % 12 || 12;
  const amPm = language() === "ar" ? (p.hour < 12 ? "ص" : "م") : p.hour < 12 ? "AM" : "PM";
  return `${pad(hour)}:${pad(p.minute)} ${amPm}`;
};

/** A date in the company's format (dd/MM/yyyy, ...); "—" (or `empty`) when there is none. */
export const formatDate = (value: unknown, empty = "—"): string => {
  const p = partsOf(value);
  return p ? datePattern(p, regional.dateFormat) : value ? String(value) : empty;
};

/** A time in the company's 12/24-hour style; "HH:mm[:ss]" strings are times of day. */
export const formatTime = (value: unknown, empty = "—"): string => {
  if (typeof value === "string") {
    const t = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim());
    if (t) return timeText({ year: 0, month: 1, day: 1, hour: +t[1], minute: +t[2] });
  }
  const p = partsOf(value);
  return p ? timeText(p) : value ? String(value) : empty;
};

export const formatDateTime = (value: unknown, empty = "—"): string => {
  const p = partsOf(value);
  return p ? `${datePattern(p, regional.dateFormat)}, ${timeText(p)}` : value ? String(value) : empty;
};

/** "Oct 2026" for a month ("2026-10" or a date). */
export const formatMonth = (value: unknown, empty = "—"): string => {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value.trim())) {
    const [y, m] = value.trim().split("-").map(Number);
    return `${monthName(m)} ${y}`;
  }
  const p = partsOf(value);
  return p ? `${monthName(p.month)} ${p.year}` : empty;
};

/* ================= Week ================= */

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// 0 = Sunday … 6 = Saturday, as Date.getDay()
const weekStartIndex = () => {
  const index = DAYS.indexOf(String(regional.weekStart).toUpperCase());
  return index >= 0 ? index : 1; // Monday when unknown
};

/** Day names (SUNDAY…) in the company's week order: Sunday first in the Gulf, Monday first by default. */
export const weekDays = (): string[] => DAYS.map((_, i) => DAYS[(weekStartIndex() + i) % 7]);

const DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_AR_MIN = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

/** A day's name (SUNDAY… or a Date) in the screen language: "short" Sun / الأحد, "long" Sunday / الأحد. */
export const weekdayName = (day: string | number | Date, style: "min" | "short" | "long" = "short"): string => {
  const index = day instanceof Date ? day.getDay() : typeof day === "number" ? day : DAYS.indexOf(String(day).toUpperCase());
  if (index < 0) return String(day);
  if (language() === "ar") return (style === "min" ? DAYS_AR_MIN : DAYS_AR)[index];
  const name = DAYS[index];
  return name.charAt(0) + (style === "long" ? name.slice(1) : name.slice(1, style === "min" ? 2 : 3)).toLowerCase();
};

/** Sun…Sat names (Sunday first, as Date.getDay()) that always read in the current screen language. */
export const liveWeekdayNames = (style: "min" | "short" | "long" = "short"): string[] =>
  new Proxy([] as string[], { get: (_target, key) => Reflect.get([0, 1, 2, 3, 4, 5, 6].map((d) => weekdayName(d, style)), key) });
/** Column headers in week order: "min" Su Mo…, "short" Sun Mon… (Arabic names when the screen is Arabic). */
export const weekdayLabels = (style: "min" | "short" = "short"): string[] => weekDays().map((d) => weekdayName(d, style));

/** Empty cells before the 1st in a month grid that starts on the company's first day of the week. */
export const leadingDays = (year: number, month: number): number =>
  (new Date(year, month, 1).getDay() - weekStartIndex() + 7) % 7;

/** The first day of the company's week containing `date` (local midnight). */
export const startOfCompanyWeek = (date: Date): Date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() - weekStartIndex() + 7) % 7));
  return start;
};

/** The company's weekend days (SATURDAY, SUNDAY by default; Friday–Saturday in Saudi Arabia). */
export const companyWeekendDays = (): string[] => [...regional.weekendDays];

/** Whether a day name (SUNDAY…) or a date falls on the company's weekend. */
export const isCompanyWeekend = (day: string | Date): boolean =>
  regional.weekendDays.includes(typeof day === "string" ? day.toUpperCase() : DAYS[day.getDay()]);

/** Today in the company's time zone as yyyy-MM-dd (date inputs, "due today"). */
export const todayIso = (): string => {
  const p = zonedParts(new Date());
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};
