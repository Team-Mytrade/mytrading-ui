/**
 * An amount written out, e.g. "One Lakh Seventy Seven Thousand Seven Hundred and Sixty Six Rupees only".
 * Rupees are grouped in lakhs and crores; other currencies in thousands, millions and billions.
 * Mirrors AmountInWords in the payroll service, so the preview and the PDF payslip read the same.
 */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const UNITS: Record<string, [major: string, minor: string, decimals: number]> = {
  INR: ["Rupees", "Paise", 2],
  AED: ["Dirhams", "Fils", 2],
  SAR: ["Riyals", "Halalas", 2],
  QAR: ["Riyals", "Dirhams", 2],
  OMR: ["Rials", "Baisa", 3],
  KWD: ["Dinars", "Fils", 3],
  BHD: ["Dinars", "Fils", 3],
  USD: ["Dollars", "Cents", 2],
  EUR: ["Euros", "Cents", 2],
  GBP: ["Pounds", "Pence", 2],
};

const belowThousand = (n: number): string => {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
    if (n > 0) parts.push("and");
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
};

const indian = (n: number): string => {
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  if (crore) parts.push(`${crore >= 1000 ? indian(crore) : belowThousand(crore)} Crore`);
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
};

const international = (n: number): string => {
  const scales = ["", " Thousand", " Million", " Billion", " Trillion"];
  const parts: string[] = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(belowThousand(chunk) + scales[scale]);
    n = Math.floor(n / 1000);
    scale++;
  }
  return parts.join(" ");
};

export const amountInWords = (amount: unknown, currency?: string | null): string => {
  const value = Number(amount);
  if (amount === null || amount === undefined || amount === "" || !Number.isFinite(value)) return "";
  const code = (currency || "INR").toUpperCase();
  const [major, minor, decimals] = UNITS[code] ?? [code, "", 2];
  const isIndian = code === "INR";
  const factor = 10 ** decimals;
  const scaled = Math.round(Math.abs(value) * factor);
  const whole = Math.floor(scaled / factor);
  const fraction = scaled % factor;
  const say = isIndian ? indian : international;

  let words = `${value < 0 ? "Minus " : ""}${whole === 0 ? "Zero" : say(whole)} ${major}`;
  if (fraction > 0 && minor) words += ` and ${say(fraction)} ${minor}`;
  return `${words} only`;
};

/**
 * Statutory employee contributions (PF, ESI, LWF, pension and social insurance: NPS, GOSI, GPSSA, ADPF), shown as
 * section B of a payslip; other deductions are taxes and deductions (C). Same rule as PayslipDTO in the payroll service.
 */
const CONTRIBUTION = /(provident fund|\bv?pf\b|\besic?\b|\blwf\b|labou?r welfare|pension|\bnps\b|gosi|gpssa|adpf|social insurance|social security)/i;
export const isContribution = (name?: string | null): boolean => !!name && CONTRIBUTION.test(name);
