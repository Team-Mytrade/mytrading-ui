import { useEffect, useState } from "react";
import { t } from "../../i18n/i18n";
import { AddressValue, SAUDI_REGIONS, SaudiParts, UAE_EMIRATES, saudiLines, saudiParts } from "../../company/regionalAddress";

// What the fields change (all plain text)
type AddressPatch = Partial<Record<"addressLine1" | "addressLine2" | "city" | "state" | "postalCode", string>>;

interface Props {
  style: "AE" | "SA";
  value: AddressValue;
  onChange: (patch: AddressPatch) => void;
  errors?: Record<string, string | undefined>;
  disabled?: boolean;
  idPrefix: string;
  inputClass: string;
  labelClass: string;
  errorClass?: string;
  // Wrapper of each field (spacing to match the page's own fields)
  fieldClass?: string;
}

/**
 * Address fields the way the UAE and Saudi Arabia write them (emirate and P.O. Box; the national address's building
 * number, street, district and additional number), kept in the usual address fields.
 */
export default function RegionalAddressFields({ style, value, onChange, errors = {}, disabled, idPrefix, inputClass, labelClass,
  errorClass = "mt-1 text-xs text-red-600", fieldClass }: Props) {
  // The Saudi parts are edited here and written back as the two lines; a half-typed building number stays put
  const [parts, setParts] = useState<SaudiParts>(() => saudiParts(value.addressLine1, value.addressLine2));
  useEffect(() => {
    const lines = saudiLines(parts);
    if (lines.addressLine1 !== value.addressLine1 || lines.addressLine2 !== (value.addressLine2 ?? "")) {
      setParts(saudiParts(value.addressLine1, value.addressLine2));
    }
    // Only an outside change of the lines (another address loaded) resets the parts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.addressLine1, value.addressLine2]);

  const setPart = (key: keyof SaudiParts, text: string) => {
    const next = { ...parts, [key]: text };
    setParts(next);
    onChange(saudiLines(next));
  };

  const input = (id: string, label: string, text: string, change: (text: string) => void, error?: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={fieldClass}>
      <label className={labelClass} htmlFor={`${idPrefix}-${id}`}>{t(label)}</label>
      <input id={`${idPrefix}-${id}`} className={inputClass} disabled={disabled} value={text}
        onChange={(e) => change(e.target.value)} {...extra} />
      {error && <p className={errorClass}>{t(error)}</p>}
    </div>
  );

  const select = (id: string, label: string, options: string[], placeholder: string, error?: string) => (
    <div className={fieldClass}>
      <label className={labelClass} htmlFor={`${idPrefix}-${id}`}>{t(label)}</label>
      <select id={`${idPrefix}-${id}`} className={inputClass} disabled={disabled} value={value.state}
        onChange={(e) => onChange({ state: e.target.value })}>
        <option value="">{t(placeholder)}</option>
        {value.state && !options.includes(value.state) && <option value={value.state}>{value.state}</option>}
        {options.map((o) => <option key={o} value={o}>{t(o)}</option>)}
      </select>
      {error && <p className={errorClass}>{t(error)}</p>}
    </div>
  );

  if (style === "AE") {
    return (
      <>
        {input("line1", "Building / villa and street *", value.addressLine1, (s) => onChange({ addressLine1: s }), errors.addressLine1,
          { maxLength: 200, placeholder: "e.g. Office 1203, Bay Square 5, Al Asayel Street" })}
        {input("line2", "Area / community", value.addressLine2 ?? "", (s) => onChange({ addressLine2: s }), errors.addressLine2,
          { maxLength: 200, placeholder: "e.g. Business Bay" })}
        {input("city", "City *", value.city, (s) => onChange({ city: s }), errors.city, { maxLength: 100 })}
        {select("state", "Emirate *", UAE_EMIRATES, "Choose the emirate", errors.state)}
        {input("postal", "P.O. Box", value.postalCode, (s) => onChange({ postalCode: s.replace(/\D/g, "") }), errors.postalCode,
          { maxLength: 7, inputMode: "numeric", placeholder: "e.g. 123456" })}
      </>
    );
  }
  return (
    <>
      {input("building", "Building number *", parts.buildingNumber, (s) => setPart("buildingNumber", s.replace(/\D/g, "").slice(0, 4)),
        errors.buildingNumber, { inputMode: "numeric", placeholder: "4 digits, e.g. 2322" })}
      {input("street", "Street *", parts.street, (s) => setPart("street", s), errors.street, { maxLength: 150, placeholder: "e.g. King Fahd Road" })}
      {input("district", "District *", parts.district, (s) => setPart("district", s), errors.district, { maxLength: 120, placeholder: "e.g. Al Olaya" })}
      {input("additional", "Additional number", parts.additionalNumber, (s) => setPart("additionalNumber", s.replace(/\D/g, "").slice(0, 4)),
        errors.additionalNumber, { inputMode: "numeric", placeholder: "4 digits, e.g. 8228" })}
      {input("city", "City *", value.city, (s) => onChange({ city: s }), errors.city, { maxLength: 100 })}
      {input("postal", "Postal code *", value.postalCode, (s) => onChange({ postalCode: s.replace(/\D/g, "").slice(0, 5) }), errors.postalCode,
        { inputMode: "numeric", placeholder: "5 digits, e.g. 12211" })}
      {select("state", "Region", SAUDI_REGIONS, "Choose the region", errors.state)}
    </>
  );
}
