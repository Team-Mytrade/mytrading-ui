import { AlertCircle, Landmark } from "lucide-react";
import { COUNTRY_OPTIONS } from "../../shared/utils/country-list";
import { countryLabel } from "../../company/regional";
import { t } from "../../i18n/i18n";
import { GCC_COUNTRIES, GulfDetails, contributionSummary } from "./gulfPayroll";

const INPUT = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition";
const LABEL = "block text-sm font-medium text-gray-700 mb-1.5";

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span>{t(message)}</span>
    </div>
  ) : null;

interface Props {
  country: string;
  gulf: GulfDetails;
  errors: Record<string, string>;
  onChange: (field: keyof GulfDetails, value: string) => void;
}

/** Nationality, IDs and IBAN for an employee paid in the Gulf (what WPS, Mudad, GPSSA and GOSI need). */
export default function GulfEmployeeFields({ country, gulf, errors, onChange }: Props) {
  const national = gulf.nationality === country;
  const gulfOptions = COUNTRY_OPTIONS.filter((c) => GCC_COUNTRIES.includes(c.code));
  const otherOptions = COUNTRY_OPTIONS.filter((c) => !GCC_COUNTRIES.includes(c.code));
  const summary = contributionSummary(country, gulf.nationality, gulf.pensionFund);
  const field = (name: keyof GulfDetails, label: string, placeholder?: string, required = false, hint?: string) => (
    <div>
      <label className={LABEL}>
        {t(label)} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={gulf[name]}
        onChange={(e) => onChange(name, e.target.value)}
        className={`${INPUT} ${errors[name] ? "border-red-500" : "border-gray-300"}`}
        placeholder={placeholder}
        dir="ltr"
      />
      <FieldError message={errors[name]} />
      {hint && !errors[name] && <p className="mt-1 text-xs text-gray-500">{t(hint)}</p>}
    </div>
  );

  return (
    <div className="space-y-4 pt-6 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Landmark className="w-4 h-4 text-cyan-600" />
        <h3 className="text-sm font-semibold text-gray-900">{t("Gulf payroll details")}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>
            {t("Nationality")} <span className="text-red-500">*</span>
          </label>
          <select
            value={gulf.nationality}
            onChange={(e) => onChange("nationality", e.target.value)}
            className={`${INPUT} ${errors.nationality ? "border-red-500" : "border-gray-300"}`}
          >
            <option value="">{t("Choose the nationality")}</option>
            <optgroup label={t("GCC")}>
              {gulfOptions.map((c) => (
                <option key={c.code} value={c.code}>{countryLabel(c.code, c.label)}</option>
              ))}
            </optgroup>
            <optgroup label={t("Other countries")}>
              {otherOptions.map((c) => (
                <option key={c.code} value={c.code}>{countryLabel(c.code, c.label)}</option>
              ))}
            </optgroup>
          </select>
          <FieldError message={errors.nationality} />
        </div>
        {field("iban", "IBAN", country === "SA" ? "SA03 8000 0000 6080 1016 7519" : "AE07 0331 2345 6789 0123 456", true,
          "The salary is paid to this account")}

        {country === "AE" && (
          <>
            {field("emiratesId", "Emirates ID", "784-1990-1234567-1")}
            {field("mohrePersonId", "MOHRE person ID", "10012345678901", false, "On the labour card; needed for WPS")}
            {field("bankRoutingCode", "Bank routing code (WPS)", "803320101", false, "The employee's bank, 9 digits")}
          </>
        )}

        {country === "SA" && (
          <>
            {field("nationalId", gulf.nationality === "SA" ? "Saudi national ID" : "Iqama number",
              gulf.nationality === "SA" ? "1012345678" : "2412345678")}
            {field("gosiNumber", "GOSI number", "123456789")}
          </>
        )}

        {country === "AE" && national && (
          <div>
            <label className={LABEL}>{t("Pension fund")}</label>
            <select
              value={gulf.pensionFund || "GPSSA"}
              onChange={(e) => onChange("pensionFund", e.target.value)}
              className={`${INPUT} border-gray-300`}
            >
              <option value="GPSSA">{t("GPSSA (federal)")}</option>
              <option value="ADPF">{t("Abu Dhabi Pension Fund (ADPF)")}</option>
            </select>
          </div>
        )}

        {national && (country === "AE" || country === "SA") && (
          <div>
            <label className={LABEL}>{t("First registered with the pension fund")}</label>
            <input
              type="date"
              value={gulf.pensionRegistrationDate}
              onChange={(e) => onChange("pensionRegistrationDate", e.target.value)}
              className={`${INPUT} border-gray-300`}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("Members from before the new pension law keep the old rates. Left empty, the joining date is used.")}
            </p>
          </div>
        )}
      </div>

      {summary && (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{t(summary)}</p>
      )}
    </div>
  );
}
