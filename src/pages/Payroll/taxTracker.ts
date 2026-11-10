// Tax tracker: income tax (TDS) over the Indian financial year, deducted so far and forecast for the months left
import { formatMoney } from "../../company/format";

export const TAX_TRACKER_API = "/v1/api/payroll/tax-tracker";

export type MonthStatus = "ACTUAL" | "FORECAST" | "NONE";

export interface EmployeeTax {
  employeeId: number;
  employeeCode?: string;
  employeeName: string;
  designation?: string;
  department?: string;
  active: boolean;
  regime?: "OLD" | "NEW" | null;
  taxPaid: number;
  taxForecast: number;
  projectedAnnualTax: number;
  takeHomePaid: number;
  takeHomeForecast: number;
  grossPaid: number;
  grossForecast: number;
  monthsPaid: number;
  monthsForecast: number;
  lastPaidMonth?: string | null;
}

export interface CompanyMonth {
  month: string;
  status: MonthStatus;
  taxPaid: number;
  taxForecast: number;
  takeHomePaid: number;
  takeHomeForecast: number;
}

export interface TaxSummary {
  financialYear: string;
  currentMonth: string;
  taxPaid: number;
  taxForecast: number;
  projectedAnnualTax: number;
  takeHomePaid: number;
  takeHomeForecast: number;
  employees: number;
  months: CompanyMonth[];
  people: EmployeeTax[];
  financialYears: string[];
}

export interface MonthLine {
  month: string;
  status: "ACTUAL" | "FORECAST";
  grossPay: number;
  providentFund: number;
  esi: number;
  professionalTax: number;
  incomeTax: number;
  otherDeductions: number;
  takeHome: number;
  payslipAvailable: boolean;
  employerPf: number;
  employerEsi: number;
}

export interface SalaryLine {
  name: string;
  yearly: number;
  monthly: number;
}

/** What the CTC is made of (fixed pay, employer PF in or on top of it, employer-paid benefits, variable pay target). */
export interface SalaryStructure {
  ctc: number;
  currency?: string;
  fixedPay: SalaryLine[];
  fixedPayTotal: number;
  employerPfYearly: number;
  employerPfInCtc: boolean;
  employerBenefits: SalaryLine[];
  variablePayTarget: number;
  costToCompany: number;
}

export interface EmployeeTaxDetail {
  employee: EmployeeTax;
  financialYear: string;
  months: MonthLine[];
  financialYears: string[];
  salary: SalaryStructure | null;
}

/** "2026-10" → "Oct 2026" (or "Oct" when short). */
export const monthLabel = (month: string, short = false) => {
  const [year, m] = month.split("-").map(Number);
  const name = new Date(year, m - 1, 1).toLocaleString("en", { month: "short" });
  return short ? name : `${name} ${year}`;
};

export const money = (value: number | null | undefined) => formatMoney(Number(value) || 0, { whole: true });

/** Share of the year's projected tax already deducted, 0–100. */
export const paidShare = (paid: number, projected: number) =>
  projected > 0 ? Math.min(100, Math.round((paid / projected) * 100)) : 0;

/** Chart colours: validated categorical slots 1 (blue, deducted) and 2 (orange, forecast), stepped per theme. */
export const chartColors = (dark: boolean) => ({
  paid: dark ? "#3987e5" : "#2a78d6",
  forecast: dark ? "#d95926" : "#eb6834",
  grid: dark ? "#2a2a2a" : "#e5e7eb",
  axis: dark ? "#9ca3af" : "#6b7280",
});

export const isDarkTheme = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
