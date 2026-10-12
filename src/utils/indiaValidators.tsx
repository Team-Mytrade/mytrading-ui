/**
 * Validation helpers for Indian business identifiers.
 * Every validator returns an error message, or null when the value is valid / empty.
 * (Whether a field is mandatory is handled separately with `required`.)
 */

const clean = (value: unknown) => String(value ?? "").trim();

/* ------------------------------------------------------------------ */
/* PAN — e.g. ABCDE1234F                                               */
/* 5 letters, 4 digits, 1 letter                                       */
/* ------------------------------------------------------------------ */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const validatePan = (value: unknown): string | null => {
  const pan = clean(value).toUpperCase();
  if (!pan) return null;
  return PAN_PATTERN.test(pan) ? null : "Enter a valid PAN (e.g. ABCDE1234F)";
};

/* ------------------------------------------------------------------ */
/* GSTIN — e.g. 37ABCDE1234F1ZZ (15 characters)                        */
/* 2-digit state code + PAN + entity no. + 'Z' + check character       */
/* ------------------------------------------------------------------ */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Official GSTIN check-character algorithm (mod 36). */
const gstinCheckCharacter = (first14: string) => {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
};

export const validateGstin = (value: unknown, pan?: unknown): string | null => {
  const gstin = clean(value).toUpperCase();
  if (!gstin) return null;

  if (!GSTIN_PATTERN.test(gstin)) {
    return "Enter a valid 15-character GSTIN (e.g. 37ABCDE1234F1ZZ)";
  }

  const stateCode = Number(gstin.slice(0, 2));
  if (stateCode < 1 || (stateCode > 38 && stateCode !== 97 && stateCode !== 99)) {
    return "GSTIN starts with an invalid state code";
  }

  if (gstinCheckCharacter(gstin.slice(0, 14)) !== gstin[14]) {
    return "GSTIN check character is wrong. Please re-check the number";
  }

  // Characters 3–12 of a GSTIN are the holder's PAN.
  const panValue = clean(pan).toUpperCase();
  if (panValue && gstin.slice(2, 12) !== panValue) {
    return "GSTIN does not match the PAN entered";
  }

  return null;
};

/* ------------------------------------------------------------------ */
/* Phone — Indian mobile or landline                                    */
/* Accepts: 9876543210, +91 98765 43210, 091-9876543210, 040-23456789   */
/* ------------------------------------------------------------------ */

/** Returns the 10 significant digits, or null if the shape is wrong. */
const toTenDigitPhone = (value: unknown): string | null => {
  let digits = clean(value).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[1-9][0-9]{9}$/.test(digits) ? digits : null;
};

export const validatePhone = (value: unknown): string | null => {
  if (!clean(value)) return null;
  return toTenDigitPhone(value)
    ? null
    : "Enter a valid 10-digit mobile number, or landline with STD code";
};

/** Stores phones in one format: +91XXXXXXXXXX. */
export const normalizePhone = (value: unknown): string | null => {
  if (!clean(value)) return null;
  const digits = toTenDigitPhone(value);
  return digits ? `+91${digits}` : clean(value);
};

/* ------------------------------------------------------------------ */
/* PIN code — 6 digits, cannot start with 0                             */
/* ------------------------------------------------------------------ */
export const validatePinCode = (value: unknown): string | null => {
  const pin = clean(value).replace(/\s/g, "");
  if (!pin) return null;
  return /^[1-9][0-9]{5}$/.test(pin) ? null : "Enter a valid 6-digit PIN code";
};

/* ------------------------------------------------------------------ */
/* IFSC — e.g. HDFC0001234 (4 letters, 0, 6 letters/digits)             */
/* ------------------------------------------------------------------ */
export const validateIfsc = (value: unknown): string | null => {
  const ifsc = clean(value).toUpperCase();
  if (!ifsc) return null;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) ? null : "Enter a valid IFSC (e.g. HDFC0001234)";
};

/* ------------------------------------------------------------------ */
/* Bank account number — 9 to 18 digits                                 */
/* ------------------------------------------------------------------ */
export const validateBankAccount = (value: unknown): string | null => {
  const account = clean(value).replace(/\s/g, "");
  if (!account) return null;
  return /^[0-9]{9,18}$/.test(account) ? null : "Bank account number must be 9–18 digits";
};

/* ------------------------------------------------------------------ */
/* Email                                                                */
/* ------------------------------------------------------------------ */
export const validateEmail = (value: unknown): string | null => {
  const email = clean(value);
  if (!email) return null;
  // The part after the last dot must be letters only (com, in, co.in…), so "gmail.com34453" is rejected.
  return /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/.test(email) ? null : "Enter a valid email address";
};

/* ------------------------------------------------------------------ */
/* Vendor code — letters/digits in groups joined by single hyphens      */
/* e.g. VEN-001, ABC-SUP-12                                             */
/* ------------------------------------------------------------------ */
export const validateVendorCode = (value: unknown): string | null => {
  const vendorCode = clean(value).toUpperCase();
  if (!vendorCode) return "Enter a vendor code (e.g. VEN-001)";
  if (vendorCode.length < 3) return "Vendor code must be at least 3 characters (e.g. VEN-001)";
  if (vendorCode.length > 20) return "Vendor code can be at most 20 characters";
  return /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(vendorCode)
    ? null
    : "Vendor code: use letters and numbers joined by single hyphens (e.g. VEN-001)";
};

/* ------------------------------------------------------------------ */
/* Website — optional, must look like a domain                          */
/* e.g. www.medline.in, https://medline.co.in                           */
/* ------------------------------------------------------------------ */
export const validateWebsite = (value: unknown): string | null => {
  const site = clean(value);
  if (!site) return null;
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(site)
    ? null
    : "Enter a valid website (e.g. www.example.com)";
};

/* ------------------------------------------------------------------ */
/* Name-like text — must contain letters, not only symbols/numbers      */
/* ------------------------------------------------------------------ */
const validateName = (label: string, value: unknown, required = false): string | null => {
  const name = clean(value);
  if (!name) return required ? `Enter the ${label.toLowerCase()}` : null;
  if (name.length < 2) return `${label} is too short`;
  return /[A-Za-z]/.test(name) ? null : `${label} must contain letters`;
};

/* ------------------------------------------------------------------ */
/* Indian states and union territories                                  */
/* gstCodes  = first 2 digits of a GSTIN registered in that state       */
/* pinPrefixes = how PIN codes in that state start                      */
/* short     = old short forms (TN, KL…) so older records still match   */
/* ------------------------------------------------------------------ */
export type IndianState = {
  name: string;
  gstCodes: string[];
  pinPrefixes: string[];
  short?: string[];
};

export const INDIAN_STATES: IndianState[] = [
  { name: "Andaman and Nicobar Islands", gstCodes: ["35"], pinPrefixes: ["744"], short: ["AN"] },
  { name: "Andhra Pradesh", gstCodes: ["37"], pinPrefixes: ["51", "52", "53"], short: ["AP"] },
  { name: "Arunachal Pradesh", gstCodes: ["12"], pinPrefixes: ["79"], short: ["AR"] },
  { name: "Assam", gstCodes: ["18"], pinPrefixes: ["78"], short: ["AS"] },
  { name: "Bihar", gstCodes: ["10"], pinPrefixes: ["80", "81", "82", "83", "84", "85"], short: ["BR"] },
  { name: "Chandigarh", gstCodes: ["04"], pinPrefixes: ["160"], short: ["CH"] },
  { name: "Chhattisgarh", gstCodes: ["22"], pinPrefixes: ["49"], short: ["CG", "CT"] },
  { name: "Dadra and Nagar Haveli and Daman and Diu", gstCodes: ["25", "26"], pinPrefixes: ["396"], short: ["DN", "DD", "DNHDD"] },
  { name: "Delhi", gstCodes: ["07"], pinPrefixes: ["11"], short: ["DL", "New Delhi", "NCT of Delhi"] },
  { name: "Goa", gstCodes: ["30"], pinPrefixes: ["403"], short: ["GA"] },
  { name: "Gujarat", gstCodes: ["24"], pinPrefixes: ["36", "37", "38", "39"], short: ["GJ"] },
  { name: "Haryana", gstCodes: ["06"], pinPrefixes: ["12", "13"], short: ["HR"] },
  { name: "Himachal Pradesh", gstCodes: ["02"], pinPrefixes: ["17"], short: ["HP"] },
  { name: "Jammu and Kashmir", gstCodes: ["01"], pinPrefixes: ["18", "19"], short: ["JK"] },
  { name: "Jharkhand", gstCodes: ["20"], pinPrefixes: ["81", "82", "83"], short: ["JH"] },
  { name: "Karnataka", gstCodes: ["29"], pinPrefixes: ["56", "57", "58", "59"], short: ["KA"] },
  { name: "Kerala", gstCodes: ["32"], pinPrefixes: ["67", "68", "69"], short: ["KL"] },
  { name: "Ladakh", gstCodes: ["38"], pinPrefixes: ["194"], short: ["LA"] },
  { name: "Lakshadweep", gstCodes: ["31"], pinPrefixes: ["682"], short: ["LD"] },
  { name: "Madhya Pradesh", gstCodes: ["23"], pinPrefixes: ["45", "46", "47", "48"], short: ["MP"] },
  { name: "Maharashtra", gstCodes: ["27"], pinPrefixes: ["40", "41", "42", "43", "44"], short: ["MH"] },
  { name: "Manipur", gstCodes: ["14"], pinPrefixes: ["795"], short: ["MN"] },
  { name: "Meghalaya", gstCodes: ["17"], pinPrefixes: ["793", "794"], short: ["ML"] },
  { name: "Mizoram", gstCodes: ["15"], pinPrefixes: ["796"], short: ["MZ"] },
  { name: "Nagaland", gstCodes: ["13"], pinPrefixes: ["797", "798"], short: ["NL"] },
  { name: "Odisha", gstCodes: ["21"], pinPrefixes: ["75", "76", "77"], short: ["OD", "OR", "Orissa"] },
  { name: "Puducherry", gstCodes: ["34"], pinPrefixes: ["605", "609", "533", "673"], short: ["PY", "Pondicherry"] },
  { name: "Punjab", gstCodes: ["03"], pinPrefixes: ["14", "15", "16"], short: ["PB"] },
  { name: "Rajasthan", gstCodes: ["08"], pinPrefixes: ["30", "31", "32", "33", "34"], short: ["RJ"] },
  { name: "Sikkim", gstCodes: ["11"], pinPrefixes: ["737"], short: ["SK"] },
  { name: "Tamil Nadu", gstCodes: ["33"], pinPrefixes: ["60", "61", "62", "63", "64"], short: ["TN"] },
  { name: "Telangana", gstCodes: ["36"], pinPrefixes: ["50"], short: ["TG", "TS"] },
  { name: "Tripura", gstCodes: ["16"], pinPrefixes: ["799"], short: ["TR"] },
  { name: "Uttar Pradesh", gstCodes: ["09"], pinPrefixes: ["20", "21", "22", "23", "24", "25", "26", "27", "28"], short: ["UP"] },
  { name: "Uttarakhand", gstCodes: ["05"], pinPrefixes: ["244", "246", "247", "248", "249", "262", "263"], short: ["UK", "UT", "Uttaranchal"] },
  { name: "West Bengal", gstCodes: ["19"], pinPrefixes: ["70", "71", "72", "73", "74"], short: ["WB"] },
];

/** Dropdown options for the State field. */
export const INDIAN_STATE_OPTIONS = INDIAN_STATES.map((state) => ({
  value: state.name,
  label: state.name,
  keywords: state.short, // typing "TN" also finds Tamil Nadu
}));

/** Finds a state by its full name or old short form ("TN", "tamil nadu" → Tamil Nadu). */
export const findIndianState = (value: unknown): IndianState | undefined => {
  const key = clean(value).toLowerCase();
  if (!key) return undefined;
  return INDIAN_STATES.find(
    (state) => state.name.toLowerCase() === key || state.short?.some((item) => item.toLowerCase() === key)
  );
};

/** Turns an old short form into the full state name; leaves anything unknown as it is. */
export const toStateName = (value: unknown): string => findIndianState(value)?.name ?? clean(value);

/** Which state a GSTIN belongs to (from its first 2 digits). */
const stateOfGstin = (gstin: string) => INDIAN_STATES.find((state) => state.gstCodes.includes(gstin.slice(0, 2)));

/** GSTIN must be registered in the same state as the vendor's address. */
export const validateGstState = (gstNumber: unknown, stateValue: unknown): string | null => {
  const gstin = clean(gstNumber).toUpperCase();
  const state = findIndianState(stateValue);
  // Nothing to compare yet (empty GST, empty/unknown state, or GST format already wrong).
  if (!gstin || !state || !GSTIN_PATTERN.test(gstin)) return null;
  if (state.gstCodes.includes(gstin.slice(0, 2))) return null;

  const gstState = stateOfGstin(gstin);
  return `This GST number is for ${gstState ? `${gstState.name} (${gstin.slice(0, 2)})` : `state code ${gstin.slice(0, 2)}`}, but the vendor's state is ${state.name} (${state.gstCodes[0]}). Use the GST number of the ${state.name} branch.`;
};

/** PIN code must belong to the vendor's state. */
export const validatePinState = (postalCode: unknown, stateValue: unknown): string | null => {
  const pin = clean(postalCode).replace(/\s/g, "");
  const state = findIndianState(stateValue);
  if (!state || !/^[1-9][0-9]{5}$/.test(pin)) return null;
  return state.pinPrefixes.some((prefix) => pin.startsWith(prefix))
    ? null
    : `PIN ${pin} is not in ${state.name}. ${state.name} PIN codes start with ${state.pinPrefixes.join(", ")}.`;
};

/* ------------------------------------------------------------------ */
/* Whole vendor form                                                    */
/* Indian formats (GST, PAN, PIN, IFSC, phone) are checked only for     */
/* vendors in India, so foreign suppliers are not blocked.              */
/* ------------------------------------------------------------------ */
export type FieldErrors = Record<string, string>;

export const validateVendorForm = (
  form: Record<string, unknown>,
  options: { checkVendorCode?: boolean } = {}
): FieldErrors => {
  const errors: FieldErrors = {};
  const add = (field: string, message: string | null) => {
    if (message) errors[field] = message;
  };

  const country = clean(form.country).toLowerCase();
  const isIndia = country === "" || country === "india";

  // Order here = order the user sees the messages (first error is shown).
  if (options.checkVendorCode !== false) add("vendorCode", validateVendorCode(form.vendorCode));
  add("name", validateName("Vendor name", form.name, true));
  add("legalName", validateName("Legal name", form.legalName));
  add("contactName", validateName("Contact name", form.contactName));
  add("contactEmail", validateEmail(form.contactEmail));
  add("website", validateWebsite(form.website));
  add("city", validateName("City", form.city));
  add("state", validateName("State", form.state));

  if (isIndia) {
    add("panNumber", validatePan(form.panNumber));
    add("gstNumber", validateGstin(form.gstNumber, form.panNumber));
    add("contactPhone", validatePhone(form.contactPhone));
    add("postalCode", validatePinCode(form.postalCode) ?? validatePinState(form.postalCode, form.state));
    // GST state is checked only when the GST format itself is fine (format error is shown first).
    if (!errors.gstNumber) add("gstNumber", validateGstState(form.gstNumber, form.state));
    add("bankIfscCode", validateIfsc(form.bankIfscCode));
    add("bankAccountNumber", validateBankAccount(form.bankAccountNumber));
  }

  return errors;
};
