// Customer tax country fields, contacts and classification (cash / credit): shared by the customer form, list and view.
// The country field definitions come from the Common service (GET /customers/form-options, CustomerCountryFields);
// the copies below are only used
// while that call is loading or when it fails, so the form always has something to show.
import { useEffect, useState } from "react";
import axios from "axios";

export const CUSTOMER_FORM_OPTIONS_API = "/v1/api/common/customers/form-options";

export type FieldTarget = "TAX_NUMBER" | "REGISTRATION_NUMBER" | "DETAIL";

export interface CountryField {
  key: string;
  label: string;
  required: boolean;
  pattern?: string | null;
  example?: string | null;
  formatHint?: string | null;
  target: FieldTarget;
}

export interface CountryDefinition {
  code: string;
  name: string;
  aliases: string[];
  fields: CountryField[];
}

export interface CustomerFormOptions {
  countries: CountryDefinition[];
}

export interface ContactRow {
  value: string;
  label?: string | null;
  primary: boolean;
}

// The customer's classification: Cash pays on the spot, Credit buys on account
export type PaymentMode = "CASH" | "CREDIT";

export const PAYMENT_MODE_OPTIONS: { id: PaymentMode; name: string }[] = [
  { id: "CASH", name: "Cash" },
  { id: "CREDIT", name: "Credit" },
];

export const OTHER_COUNTRY = "OTHER";

const tax = (label: string, pattern: string | null, example: string | null, formatHint: string | null): CountryField => ({
  key: "taxNumber", label, required: false, pattern, example, formatHint, target: "TAX_NUMBER",
});
const registration = (label: string, pattern: string | null, example: string | null, formatHint: string | null): CountryField => ({
  key: "registrationNumber", label, required: false, pattern, example, formatHint, target: "REGISTRATION_NUMBER",
});
const CR = "[A-Z0-9/-]{1,20}";
const CR_HINT = "A CR number is up to 20 letters, digits, hyphens or slashes";

// Same as CustomerCountryFields.COUNTRIES in the Common service
export const FALLBACK_FORM_OPTIONS: CustomerFormOptions = {
  countries: [
    { code: "IN", name: "India", aliases: ["in", "india", "bharat"], fields: [
      tax("GSTIN", "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]", "29ABCDE1234F1Z5", "A GSTIN is 15 characters, like 29ABCDE1234F1Z5"),
      { key: "pan", label: "PAN", required: false, pattern: "[A-Z]{5}[0-9]{4}[A-Z]", example: "ABCDE1234F", formatHint: "A PAN is 10 characters: 5 letters, 4 digits, 1 letter (like ABCDE1234F)", target: "DETAIL" },
      registration("CIN / registration number", "[A-Z0-9-]{1,30}", "U12345KA2020PTC123456", "Use letters, digits or hyphens"),
    ] },
    { code: "QA", name: "Qatar", aliases: ["qa", "qatar", "state of qatar"], fields: [
      tax("Tax card number (TIN)", "[0-9]{5,15}", "5000123456", "A Qatar tax card number is 5 to 15 digits"),
      registration("CR number", CR, "123456", CR_HINT),
    ] },
    { code: "AE", name: "United Arab Emirates", aliases: ["ae", "uae", "u.a.e", "u.a.e.", "united arab emirates", "emirates"], fields: [
      tax("TRN", "100[0-9]{12}", "100123456700003", "A UAE TRN is 15 digits starting with 100"),
      registration("Trade licence number", "[A-Z0-9/-]{1,30}", "CN-1234567", "Use letters, digits, hyphens or slashes"),
    ] },
    { code: "SA", name: "Saudi Arabia", aliases: ["sa", "ksa", "saudi arabia", "kingdom of saudi arabia", "saudi"], fields: [
      tax("VAT number", "3[0-9]{13}3", "300012345600003", "A Saudi VAT number is 15 digits that start and end with 3"),
      registration("CR number", "[0-9]{10}", "1010123456", "A Saudi CR number is 10 digits"),
    ] },
    { code: "BH", name: "Bahrain", aliases: ["bh", "bahrain", "kingdom of bahrain"], fields: [
      tax("VAT account number", "[0-9]{15}", "200000123400002", "A Bahrain VAT account number is 15 digits"),
      registration("CR number", CR, "12345-1", CR_HINT),
    ] },
    { code: "OM", name: "Oman", aliases: ["om", "oman", "sultanate of oman"], fields: [
      tax("VATIN", "OM[0-9]{10}", "OM1100012345", "An Omani VATIN is OM and 10 digits"),
      registration("CR number", CR, "1234567", CR_HINT),
    ] },
    { code: "KW", name: "Kuwait", aliases: ["kw", "kuwait", "state of kuwait"], fields: [
      tax("Tax number", "[A-Z0-9-]{5,20}", "123456789", "Use 5 to 20 letters, digits or hyphens"),
      registration("CR number", CR, "123456", CR_HINT),
    ] },
    { code: OTHER_COUNTRY, name: "Other", aliases: [], fields: [
      tax("Tax number", "[A-Z0-9-]{5,20}", null, "Use 5 to 20 letters, digits or hyphens"),
      registration("Registration number", null, null, null),
    ] },
  ],
};

let cached: CustomerFormOptions | null = null;

/** The country fields (the built-in copy until the service answers, or if it can't). */
export const useCustomerFormOptions = (): CustomerFormOptions => {
  const [options, setOptions] = useState<CustomerFormOptions>(cached ?? FALLBACK_FORM_OPTIONS);
  useEffect(() => {
    if (cached) return;
    let live = true;
    axios
      .get<CustomerFormOptions>(CUSTOMER_FORM_OPTIONS_API)
      .then(({ data }) => {
        if (!data || !Array.isArray(data.countries) || !data.countries.length) return;
        cached = { countries: data.countries };
        if (live) setOptions(cached);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return options;
};

/** The definition for a country code or name ("IN", "India", "UAE"...); the generic one for anything else. */
export const countryDefinition = (options: CustomerFormOptions, country?: string | null): CountryDefinition => {
  const key = (country ?? "").trim().toLowerCase();
  const other = options.countries.find((c) => c.code === OTHER_COUNTRY) ?? FALLBACK_FORM_OPTIONS.countries[FALLBACK_FORM_OPTIONS.countries.length - 1];
  if (!key) return other;
  return options.countries.find((c) => c.code.toLowerCase() === key || c.aliases.includes(key)) ?? other;
};

/** Stored form of a tax / registration value: no spaces, upper-case. */
export const cleanRegistration = (value: string) => value.replace(/\s+/g, "").toUpperCase();

/** What is wrong with the value for the field, or null (the service applies the same rules). */
export const countryFieldProblem = (field: CountryField, raw: string): string | null => {
  const value = cleanRegistration(raw ?? "");
  if (!value) return field.required ? `${field.label} is required` : null;
  if (value.length > 50) return `Keep ${field.label} to 50 characters`;
  if (field.pattern && !new RegExp(`^(?:${field.pattern})$`).test(value)) {
    return field.formatHint || `${field.label} is not in the right format`;
  }
  return null;
};

/** The customer's contacts as rows; customers saved before the lists come back with their single value. */
export const contactRowsOf = (rows: unknown, single?: string | null): ContactRow[] => {
  const list = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && String(r.value ?? "").trim())
    .map((r) => ({ value: String(r.value), label: r.label ?? "", primary: Boolean(r.primary) }));
  if (!list.length && single && single.trim()) return [{ value: single.trim(), label: "", primary: true }];
  if (list.length && !list.some((r) => r.primary)) list[0] = { ...list[0], primary: true };
  return list;
};
