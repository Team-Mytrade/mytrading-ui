import { useCompany } from "./companyApi";
import { findCountry } from "./regional";

/**
 * Which payroll rules a company follows, from its country (Company Settings): India (income tax, IT declarations,
 * PF) or the Gulf (no income tax; pension / social insurance and end-of-service gratuity). Anything else, or no
 * country set yet, counts as India, the product's default.
 */
export type PayrollRegion = "IN" | "GCC";

const GULF = new Set([
  "AE", "SA", "QA", "OM", "BH", "KW",
  "united arab emirates", "uae", "saudi arabia", "ksa", "qatar", "oman", "bahrain", "kuwait",
]);

export const payrollRegionOf = (country?: string | null): PayrollRegion => {
  const value = (country || "").trim();
  return GULF.has(value) || GULF.has(value.toLowerCase()) ? "GCC" : "IN";
};

/** The signed-in user's company's payroll region (India until the company profile has loaded). */
export const usePayrollRegion = (): PayrollRegion => {
  const { company } = useCompany();
  return payrollRegionOf(company?.country);
};

/** Where the company is: its payroll region and its country's ISO code ("" when not set). */
export interface CompanyPlace {
  region: PayrollRegion;
  country: string;
}

const SHORT_NAMES: Record<string, string> = { uae: "AE", "u.a.e": "AE", "u.a.e.": "AE", ksa: "SA", "k.s.a": "SA", saudi: "SA" };

/** The ISO code for a country name or code as Company Settings stores it ("India", "United Arab Emirates", "AE"…). */
export const countryCodeOf = (country?: string | null): string => {
  const value = (country || "").trim();
  if (!value) return "";
  return SHORT_NAMES[value.toLowerCase()] ?? findCountry(value)?.isoCode ?? (value.length === 2 ? value.toUpperCase() : "");
};

export const companyPlaceOf = (country?: string | null): CompanyPlace => ({ region: payrollRegionOf(country), country: countryCodeOf(country) });

/** The signed-in user's company's place (India until the company profile has loaded). */
export const useCompanyPlace = (): CompanyPlace => {
  const { company } = useCompany();
  return companyPlaceOf(company?.country);
};

/**
 * Pages that only make sense in some countries, by a region (IN, GCC) or a country's ISO code. The menu, the header
 * search, the dashboards' links and the Report Center leave them out elsewhere; the page itself still opens from a
 * link (its help says who it is for).
 */
export const REGIONAL_PAGES: Record<string, string[]> = {
  "/it-declaration": ["IN"],
  "/gulfPayFiles": ["GCC"],
  "/gratuityProvision": ["GCC"],
  "/vatReturn": ["GCC"],
  "/exportEvidence": ["GCC"],
  "/zatca": ["SA"],
  "/uae-einvoicing": ["AE"],
};

/** Whether a page is offered to a company in this place (pages not listed are for everyone). */
export const pageForPlace = (path: string | undefined, place: CompanyPlace): boolean => {
  const only = path ? REGIONAL_PAGES[path] : undefined;
  return !only || only.includes(place.region) || (!!place.country && only.includes(place.country));
};
