// Addresses the way each country writes them, stored in the usual fields (line 1, line 2, city, state, postal code):
// - UAE: building / villa and street, area, city, emirate (the state), P.O. Box (the postal code; there are no postcodes)
// - Saudi Arabia, national address: "1234 King Fahd Road" (building number + street) / "Al Olaya, Additional No. 5678"
//   (district + additional number), city, region (the state), 5-digit postal code. The invoice service reads these
//   parts back for ZATCA e-invoices.
// Other countries keep the plain fields.
import { findCountry } from "./regional";

export type AddressStyle = "AE" | "SA" | "OTHER";

const ALIASES: Record<string, AddressStyle> = {
  uae: "AE", "u.a.e": "AE", "u.a.e.": "AE", emirates: "AE",
  ksa: "SA", "k.s.a": "SA", "saudi": "SA", "kingdom of saudi arabia": "SA",
};

/** The address layout for a country (its name, ISO code or a common short name). */
export const addressStyle = (country?: string | null): AddressStyle => {
  const wanted = (country ?? "").trim().toLowerCase();
  const code = ALIASES[wanted] ?? findCountry(wanted)?.isoCode;
  return code === "AE" || code === "SA" ? code : "OTHER";
};

export const UAE_EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

export const SAUDI_REGIONS = [
  "Riyadh", "Makkah", "Madinah", "Eastern Province", "Qassim", "Asir", "Tabuk", "Ha'il", "Northern Borders",
  "Jazan", "Najran", "Al Bahah", "Al Jawf",
];

export interface AddressValue {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}

export interface SaudiParts {
  buildingNumber: string;
  street: string;
  district: string;
  additionalNumber: string;
}

const ADDITIONAL = /^\s*(.*?)\s*,?\s*Additional No\.?\s*(\d*)\s*$/i;

/** The national address's parts from the two lines (lines written another way stay whole as street / district). */
export const saudiParts = (line1?: string | null, line2?: string | null): SaudiParts => {
  const first = /^\s*(\d{1,4})\s+(.*)$/.exec(line1 ?? "");
  const second = ADDITIONAL.exec(line2 ?? "");
  return {
    buildingNumber: first?.[1] ?? "",
    street: first ? first[2] : (line1 ?? ""),
    district: second ? second[1] : (line2 ?? ""),
    additionalNumber: second?.[2] ?? "",
  };
};

export const saudiLines = (p: SaudiParts): { addressLine1: string; addressLine2: string } => ({
  addressLine1: [p.buildingNumber.trim(), p.street.trim()].filter(Boolean).join(" "),
  addressLine2: p.district.trim() + (p.additionalNumber.trim() ? `${p.district.trim() ? ", " : ""}Additional No. ${p.additionalNumber.trim()}` : ""),
});

/** Problems with a UAE or Saudi address, keyed by field (Saudi parts by their own names). */
export const regionalAddressErrors = (style: AddressStyle, value: AddressValue): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (style === "AE") {
    if (!value.addressLine1.trim()) errors.addressLine1 = "Enter the building / villa and street";
    if (!value.city.trim()) errors.city = "Enter the city or area";
    // One of the seven (e-invoices carry the emirate's code)
    if (!UAE_EMIRATES.includes(value.state.trim())) errors.state = "Choose the emirate";
    if (value.postalCode.trim() && !/^\d{1,7}$/.test(value.postalCode.trim())) errors.postalCode = "The P.O. Box is a number";
  }
  if (style === "SA") {
    const parts = saudiParts(value.addressLine1, value.addressLine2);
    if (!/^\d{4}$/.test(parts.buildingNumber)) errors.buildingNumber = "The building number has 4 digits";
    if (!parts.street.trim()) errors.street = "Enter the street";
    if (!parts.district.trim()) errors.district = "Enter the district";
    if (parts.additionalNumber && !/^\d{4}$/.test(parts.additionalNumber)) errors.additionalNumber = "The additional number has 4 digits";
    if (!value.city.trim()) errors.city = "Enter the city";
    if (!/^\d{5}$/.test(value.postalCode.trim())) errors.postalCode = "The postal code has 5 digits";
  }
  return errors;
};

/** The address as printed, in the country's order. */
export const regionalAddressLines = (value: AddressValue & { country?: string | null }, showCountry = true): string[] => {
  const style = addressStyle(value.country);
  const country = showCountry && value.country ? value.country : "";
  const lines = style === "AE"
    ? [value.addressLine1, value.addressLine2, [value.city, value.state].filter(Boolean).join(", "),
        value.postalCode ? `P.O. Box ${value.postalCode}` : "", country]
    : style === "SA"
      ? [value.addressLine1, value.addressLine2, [value.city, value.postalCode].filter(Boolean).join(" "), value.state, country]
      : [value.addressLine1, value.addressLine2, [value.city, value.state].filter(Boolean).join(", ") + (value.postalCode ? ` - ${value.postalCode}` : ""), country];
  return lines.map((line) => String(line ?? "").trim().replace(/^- /, "")).filter(Boolean);
};
