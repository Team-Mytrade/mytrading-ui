// A company's regional settings (user-service /v1/api/user/company): what can be chosen, per-country
// defaults, and preview formatting. Language, currency and time zone are independent settings.
import { Country, type ICountry } from "country-state-city";

export interface RegionalSettings {
  currency: string;
  // Digits after the decimal point for money (KWD, BHD, OMR: 3)
  currencyDecimals: number;
  language: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  numberLocale: string;
  weekStart: string;
  weekendDays: string[];
}

// What the system did before these settings existed
export const DEFAULT_REGIONAL: RegionalSettings = {
  currency: "INR",
  currencyDecimals: 2,
  language: "en",
  timeZone: "Asia/Kolkata",
  dateFormat: "dd/MM/yyyy",
  timeFormat: "12h",
  numberLocale: "en-IN",
  weekStart: "MONDAY",
  weekendDays: ["SATURDAY", "SUNDAY"],
};

export const LANGUAGES = [
  { value: "en", label: "English" },
  // Menus, common screens and controls are translated; the rest of the pages follow module by module
  { value: "ar", label: "العربية Arabic" },
];

export const DATE_FORMATS = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd.MM.yyyy", "dd MMM yyyy"];

export const NUMBER_LOCALES = [
  { value: "en-US", label: "1,234,567.89" },
  { value: "en-IN", label: "12,34,567.89 (Indian lakh grouping)" },
  { value: "de-DE", label: "1.234.567,89" },
  { value: "fr-FR", label: "1 234 567,89" },
];

// Monday first, as the server sorts them
export const WEEK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
export const WEEK_STARTS = ["SATURDAY", "SUNDAY", "MONDAY"];
export const dayLabel = (day: string) => day.charAt(0) + day.slice(1).toLowerCase();

// Weekends and week starts that differ from Sat–Sun / Monday (others use those)
const WEEK_BY_COUNTRY: Record<string, { weekendDays: string[]; weekStart: string }> = {
  SA: { weekendDays: ["FRIDAY", "SATURDAY"], weekStart: "SUNDAY" },
  QA: { weekendDays: ["FRIDAY", "SATURDAY"], weekStart: "SUNDAY" },
  KW: { weekendDays: ["FRIDAY", "SATURDAY"], weekStart: "SUNDAY" },
  BH: { weekendDays: ["FRIDAY", "SATURDAY"], weekStart: "SUNDAY" },
  OM: { weekendDays: ["FRIDAY", "SATURDAY"], weekStart: "SUNDAY" },
  JO: { weekendDays: ["FRIDAY", "SATURDAY"], weekStart: "SUNDAY" },
  EG: { weekendDays: ["FRIDAY", "SATURDAY"], weekStart: "SUNDAY" },
  // UAE moved to a Saturday–Sunday weekend in 2022
  AE: { weekendDays: ["SATURDAY", "SUNDAY"], weekStart: "MONDAY" },
};

// Number styles by country; the rest use 1,234,567.89
const NUMBER_LOCALE_BY_COUNTRY: Record<string, string> = {
  IN: "en-IN", DE: "de-DE", AT: "de-DE", IT: "de-DE", ES: "de-DE", NL: "de-DE", FR: "fr-FR", BE: "fr-FR",
};

const PREFERRED_ZONE: Record<string, string> = { IN: "Asia/Kolkata", US: "America/New_York", AU: "Australia/Sydney" };

export const countries = (): ICountry[] => Country.getAllCountries();

export const findCountry = (name?: string | null): ICountry | undefined => {
  const wanted = (name ?? "").trim().toLowerCase();
  return wanted ? countries().find((c) => c.name.toLowerCase() === wanted || c.isoCode.toLowerCase() === wanted) : undefined;
};

/** The currency's usual decimals from the browser (KWD 3, AED 2, JPY 0); 2 when unknown. */
export const currencyDigits = (code: string): number => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};

/** A country's usual regional settings (currency, zone, weekend, number style); language is kept. */
export const presetForCountry = (country: ICountry): Partial<RegionalSettings> => {
  const week = WEEK_BY_COUNTRY[country.isoCode] ?? { weekendDays: ["SATURDAY", "SUNDAY"], weekStart: "MONDAY" };
  const zone = PREFERRED_ZONE[country.isoCode] ?? country.timezones?.[0]?.zoneName;
  const preset: Partial<RegionalSettings> = {
    ...week,
    numberLocale: NUMBER_LOCALE_BY_COUNTRY[country.isoCode] ?? "en-US",
  };
  if (country.currency) {
    preset.currency = country.currency;
    preset.currencyDecimals = currencyDigits(country.currency);
  }
  if (zone) preset.timeZone = zone;
  return preset;
};

// Countries with VAT (5% UAE/Oman, 15% Saudi Arabia, 10% Bahrain); Kuwait and Qatar have none yet
const VAT_COUNTRIES = ["AE", "SA", "BH", "OM", "GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "EG", "JO"];
const NO_VAT_COUNTRIES = ["KW", "QA"];

/** The usual tax registration for a country, or undefined to keep the current choice. */
export const taxRegimeForCountry = (country: ICountry): "VAT" | "GST" | "NONE" | undefined =>
  country.isoCode === "IN" ? "GST" : VAT_COUNTRIES.includes(country.isoCode) ? "VAT"
    : NO_VAT_COUNTRIES.includes(country.isoCode) ? "NONE" : undefined;

/** A VAT registration number's problem for the country, or null when it looks right. */
export const vatNumberError = (value: string | null | undefined, countryName?: string | null): string | null => {
  const number = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  if (!number) return "Enter the VAT registration number (TRN)";
  const iso = findCountry(countryName)?.isoCode;
  if (iso === "AE" && !/^100\d{12}$/.test(number)) return "A UAE TRN is 15 digits starting with 100";
  if (iso === "SA" && !/^3\d{13}3$/.test(number)) return "A Saudi VAT number is 15 digits that start and end with 3";
  if (!/^[A-Z0-9-]{5,20}$/.test(number)) return "Use 5 to 20 letters, digits or hyphens";
  return null;
};

type SupportedValues = (key: "timeZone" | "currency") => string[];
const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: SupportedValues }).supportedValuesOf;

/** IANA time zones the browser knows (Asia/Dubai, ...). */
export const timeZones = (): string[] => {
  const zones = supportedValuesOf?.("timeZone") ?? [];
  return zones.length ? zones : ["UTC", "Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Bahrain", "Asia/Muscat", "Asia/Kolkata", "Europe/London"];
};

/** ISO currencies with their English names, Gulf currencies and INR first. */
export const currencies = (): { code: string; name: string }[] => {
  const first = ["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "INR", "USD", "EUR", "GBP"];
  const codes = supportedValuesOf?.("currency") ?? first;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en"], { type: "currency" });
  } catch {
    names = null;
  }
  const all = Array.from(new Set([...first, ...codes]));
  return all.map((code) => ({ code, name: names?.of(code) ?? code }));
};

/** A date in the given pattern and zone, e.g. ("dd MMM yyyy", "Asia/Dubai") → "28 Oct 2026". */
export const formatDateIn = (date: Date, pattern: string, timeZone: string): string => {
  const parts = (opts: Intl.DateTimeFormatOptions) =>
    Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, ...opts }).formatToParts(date).map((p) => [p.type, p.value]));
  const numeric = parts({ year: "numeric", month: "2-digit", day: "2-digit" });
  const short = parts({ month: "short" });
  return pattern
    .replace("yyyy", numeric.year)
    .replace("MMM", short.month)
    .replace("MM", numeric.month)
    .replace("dd", numeric.day);
};

export const formatTimeIn = (date: Date, timeFormat: string, timeZone: string): string =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: timeFormat !== "24h" }).format(date);

export const formatMoneyIn = (amount: number, currency: string, decimals: number, numberLocale: string): string => {
  const number = new Intl.NumberFormat(numberLocale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
  return `${currency} ${number}`;
};
