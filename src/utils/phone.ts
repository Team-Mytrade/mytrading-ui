// Phone number checks shared by the forms (customers, employees, CRM). The services apply the same rules.
//
// UAE numbers (+971) are checked by their real lengths, after +971:
//   mobile    9 digits, 50 / 52 / 54 / 55 / 56 / 58 + 7 digits      +971 50 123 4567
//   landline  8 digits, area code 2 / 3 / 4 / 6 / 7 / 9 + 7 digits  +971 4 321 6543
//   toll-free 800 + 4–7 digits                                       800 4433
//   shared    600 + 6 digits                                         600 522 222
// Other countries: 7–15 digits (the international maximum).

const ALLOWED_CHARACTERS = /^\+?[\d\s().-]+$/;

const UAE_MOBILE = /^5[024568]\d{7}$/;
const UAE_LANDLINE = /^[234679]\d{7}$/;
const UAE_TOLL_FREE = /^800\d{4,7}$/;
const UAE_SHARED_COST = /^600\d{6}$/;

export const UAE_PHONE_HINT =
  "Enter a UAE mobile (+971 5X XXX XXXX, 9 digits after +971) or landline (+971 X XXX XXXX, 8 digits after +971)";

/** The digits after the UAE code when the number is written with it (+971, 00971 or 971), else null. */
const uaeNationalNumber = (value: string): string | null => {
  const v = value.trim();
  const digits = v.replace(/\D/g, "");
  let national: string | null = null;
  if (v.startsWith("+")) national = digits.startsWith("971") ? digits.slice(3) : null;
  else if (digits.startsWith("00971")) national = digits.slice(5);
  else if (digits.startsWith("971") && digits.length >= 10) national = digits.slice(3);
  // "+971 0 50 123 4567": the trunk 0 isn't dialled after the country code
  return national !== null && national.startsWith("0") ? national.slice(1) : national;
};

const uaeProblem = (national: string): string | null => {
  if (UAE_MOBILE.test(national) || UAE_LANDLINE.test(national) || UAE_TOLL_FREE.test(national) || UAE_SHARED_COST.test(national)) {
    return null;
  }
  if (national.startsWith("5")) {
    if (national.length !== 9) return "A UAE mobile has 9 digits after +971, like +971 50 123 4567";
    return "UAE mobiles start with 50, 52, 54, 55, 56 or 58";
  }
  if (/^[234679]/.test(national)) return "A UAE landline has 8 digits after +971, like +971 4 321 6543";
  if (/^[18]/.test(national) && !national.startsWith("800")) return `Area code ${national[0]} doesn't exist in the UAE`;
  return UAE_PHONE_HINT;
};

/** What is wrong with a phone number, or null (blank is fine here; "required" is checked by the form). */
export const phoneProblem = (value: string | null | undefined): string | null => {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!ALLOWED_CHARACTERS.test(v)) return "Use digits only; spaces, dashes, brackets and a leading + are fine";
  const uae = uaeNationalNumber(v);
  if (uae !== null) return uaeProblem(uae);
  const digits = v.replace(/\D/g, "").length;
  if (digits < 7 || digits > 15) return "Use 7–15 digits; spaces, dashes, brackets and a leading + are fine";
  return null;
};

/** A number from a digits-only phone box ("971501234567") with its "+" ("+971501234567"); others unchanged. */
export const withPlus = (value: string | null | undefined): string => {
  const v = (value ?? "").trim();
  return /^\d/.test(v) ? `+${v}` : v;
};
