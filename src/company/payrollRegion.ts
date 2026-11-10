import { useCompany } from "./companyApi";

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
