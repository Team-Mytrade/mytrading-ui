// Gulf payroll (UAE, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait): pay, pension shares and gratuity by calendar year

export const GULF_PAY_API = "/v1/api/payroll/pay-tracker";

export interface GulfMonthLine {
  month: string;
  status: "ACTUAL" | "FORECAST";
  grossPay: number;
  employeeContribution: number;
  otherDeductions: number;
  takeHome: number;
  employerContribution: number;
  gratuityAccrual: number;
  payslipAvailable: boolean;
}

export interface GulfPackageLine {
  name: string;
  yearly: number;
  monthly: number;
}

export interface GulfPayPackage {
  currency?: string;
  fixedPay: GulfPackageLine[];
  fixedPayTotal: number;
  employerContributionYearly: number;
  gratuityYearly: number;
  costToCompany: number;
  gratuityToDate: number;
  scheme?: string | null;
  gccNational: boolean;
}

export interface GulfEmployeePay {
  employeeId: number;
  employeeCode?: string;
  employeeName: string;
  designation?: string;
  department?: string;
  countryCode?: string;
  active: boolean;
  netPaid: number;
  netForecast: number;
  employeeContributionPaid: number;
  employerContributionPaid: number;
  gratuityAccrued: number;
  grossPaid: number;
  monthsPaid: number;
  monthsForecast: number;
  lastPaidMonth?: string | null;
  scheme?: string | null;
}

export interface GulfEmployeeDetail {
  employee: GulfEmployeePay;
  year: number;
  months: GulfMonthLine[];
  years: number[];
  pay: GulfPayPackage;
}

export interface GulfCompanyMonth {
  month: string;
  status: "ACTUAL" | "FORECAST" | "NONE";
  netPaid: number;
  netForecast: number;
  employeeContribution: number;
  employerContribution: number;
  gratuityAccrual: number;
}

export interface GulfSummary {
  year: number;
  currentMonth: string;
  currency?: string;
  employees: number;
  netPaid: number;
  netForecast: number;
  employerContributionPaid: number;
  gratuityAccrued: number;
  months: GulfCompanyMonth[];
  people: GulfEmployeePay[];
  years: number[];
}
