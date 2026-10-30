import { companyCurrency } from "../../company/format";
import { countryLabel } from "../../company/regional";
import { COUNTRY_OPTIONS } from "../../shared/utils/country-list";
import { t } from "../../i18n/i18n";

// The countries payroll can pay under (the service has a calculator for each)
export const PAYROLL_COUNTRIES = [
  { code: "IN", label: "India", currency: "INR" },
  { code: "AE", label: "United Arab Emirates", currency: "AED" },
  { code: "SA", label: "Saudi Arabia", currency: "SAR" },
  { code: "QA", label: "Qatar", currency: "QAR" },
  { code: "OM", label: "Oman", currency: "OMR" },
  { code: "BH", label: "Bahrain", currency: "BHD" },
  { code: "KW", label: "Kuwait", currency: "KWD" },
];

export const GCC_COUNTRIES = ["AE", "SA", "QA", "OM", "BH", "KW"];
export const isGcc = (country?: string | null) => !!country && GCC_COUNTRIES.includes(country.toUpperCase());

/** A new employee is paid under the company's country, going by its currency (India otherwise). */
export const defaultPayrollCountry = (): string =>
  PAYROLL_COUNTRIES.find((c) => c.currency === companyCurrency()?.toUpperCase())?.code ?? "IN";

/** The salary's country as the service has always stored it ("INDIA" for India, else the ISO code). */
export const salaryCountry = (code: string) => (code === "IN" ? "INDIA" : code);

// The Gulf details, kept in the employee's country data next to PAN and Aadhaar
export interface GulfDetails {
  nationality: string;
  emiratesId: string;
  mohrePersonId: string;
  iban: string;
  bankRoutingCode: string;
  pensionFund: string;
  nationalId: string;
  gosiNumber: string;
  pensionRegistrationDate: string;
}

export const EMPTY_GULF: GulfDetails = {
  nationality: "",
  emiratesId: "",
  mohrePersonId: "",
  iban: "",
  bankRoutingCode: "",
  pensionFund: "",
  nationalId: "",
  gosiNumber: "",
  pensionRegistrationDate: "",
};

export const GULF_LABELS: Record<string, string> = {
  nationality: "Nationality",
  emiratesId: "Emirates ID",
  mohrePersonId: "MOHRE person ID",
  iban: "IBAN",
  bankRoutingCode: "Bank routing code (WPS)",
  pensionFund: "Pension fund",
  nationalId: "Saudi ID / Iqama",
  gosiNumber: "GOSI number",
  pensionRegistrationDate: "First registered with the pension fund",
};

/** A Gulf field as shown: the nationality by name, the pension fund by its full name, the rest as stored. */
export const gulfValueLabel = (key: string, value: string): string => {
  if (key === "nationality") return countryLabel(value, COUNTRY_OPTIONS.find((c) => c.code === value)?.label ?? value);
  if (key === "pensionFund") return t(value === "ADPF" ? "Abu Dhabi Pension Fund (ADPF)" : "GPSSA (federal)");
  return value;
};

export const gulfFromCountryData = (data?: Record<string, unknown> | null): GulfDetails => {
  const gulf = { ...EMPTY_GULF };
  (Object.keys(gulf) as (keyof GulfDetails)[]).forEach((key) => {
    const value = data?.[key];
    if (value != null) gulf[key] = String(value);
  });
  return gulf;
};

/** The fields that apply to the payroll country (the others are left out, so a move doesn't keep stale IDs). */
export const gulfToCountryData = (country: string, gulf: GulfDetails): Record<string, string> => {
  if (!isGcc(country)) return {};
  const national = gulf.nationality === country;
  const data: Record<string, string> = { nationality: gulf.nationality, iban: gulf.iban.replace(/\s+/g, "").toUpperCase() };
  if (country === "AE") {
    data.emiratesId = gulf.emiratesId.replace(/[\s-]/g, "");
    data.mohrePersonId = gulf.mohrePersonId.replace(/\s/g, "");
    data.bankRoutingCode = gulf.bankRoutingCode.replace(/\s/g, "");
    if (national) data.pensionFund = gulf.pensionFund || "GPSSA";
  }
  if (country === "SA") {
    data.nationalId = gulf.nationalId.replace(/\D/g, "");
    data.gosiNumber = gulf.gosiNumber.replace(/\s/g, "");
  }
  if (national && (country === "AE" || country === "SA")) data.pensionRegistrationDate = gulf.pensionRegistrationDate;
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value));
};

/** ISO 13616 check digits: the rearranged IBAN, read as a number, leaves 1 when divided by 97. */
const ibanChecks = (iban: string) => {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};

/** Problems with the Gulf fields, by field name (the same checks the service makes). */
export const gulfErrors = (country: string, gulf: GulfDetails): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!isGcc(country)) return errors;
  if (!gulf.nationality) errors.nationality = "Choose the nationality";
  const iban = gulf.iban.replace(/\s+/g, "").toUpperCase();
  if (!iban) errors.iban = "Enter the IBAN the salary is paid to";
  else if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban)) errors.iban = "Enter the IBAN (2 letters, 2 check digits, then the account)";
  else if (country === "AE" && !/^AE\d{21}$/.test(iban)) errors.iban = "A UAE IBAN is AE followed by 21 digits";
  else if (country === "SA" && !/^SA\d{4}[A-Z0-9]{18}$/.test(iban)) errors.iban = "A Saudi IBAN is SA followed by 22 characters";
  else if (!ibanChecks(iban)) errors.iban = "The IBAN's check digits don't match; check it for a typing mistake";
  if (country === "AE") {
    const emiratesId = gulf.emiratesId.replace(/[\s-]/g, "");
    if (emiratesId && !/^784\d{12}$/.test(emiratesId)) errors.emiratesId = "An Emirates ID has 15 digits and starts with 784";
    if (gulf.mohrePersonId && !/^\d{14}$/.test(gulf.mohrePersonId.trim())) errors.mohrePersonId = "The MOHRE person ID (labour card) has 14 digits";
    if (gulf.bankRoutingCode && !/^\d{9}$/.test(gulf.bankRoutingCode.trim())) errors.bankRoutingCode = "The bank's WPS routing code has 9 digits";
  }
  if (country === "SA") {
    const id = gulf.nationalId.replace(/\D/g, "");
    if (id && !/^[12]\d{9}$/.test(id)) errors.nationalId = "A Saudi ID or Iqama number has 10 digits and starts with 1 or 2";
    else if (id && (gulf.nationality === "SA") !== id.startsWith("1")) {
      errors.nationalId = "Saudi citizens have an ID starting with 1, residents an Iqama starting with 2";
    }
    if (gulf.gosiNumber && !/^\d+$/.test(gulf.gosiNumber.trim())) errors.gosiNumber = "The GOSI number is digits only";
  }
  return errors;
};

/** Who pays what, in a line, for the form and the employee page. */
export const contributionSummary = (country: string, nationality: string, pensionFund?: string): string => {
  if (!isGcc(country) || !nationality) return "";
  if (country === "AE" && nationality === "AE") {
    return pensionFund === "ADPF"
      ? "Abu Dhabi Pension Fund: 11% from pay, 15% paid by the company (on basic + housing)"
      : "GPSSA pension: 11% from pay, 15% paid by the company (12.5% under AED 20,000), on basic + housing";
  }
  if (country === "SA" && nationality === "SA") {
    return "GOSI: annuities 9% (rising for new entrants) and SANED 0.75% from pay; the company pays the same plus 2% hazards";
  }
  if (country === "SA") return "GOSI: nothing from pay; the company pays 2% occupational hazards";
  if (isGcc(nationality)) return "GCC national: their home country's pension through the GCC extension (approximate rates)";
  if (country === nationality) return "National: social insurance at approximate rates";
  return country === "AE" ? "No pension; end-of-service gratuity builds up instead" : "No social insurance for expatriates";
};
