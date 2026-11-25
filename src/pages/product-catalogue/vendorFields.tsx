// Vendor form pieces the generic resource page has no control for: several contact people, payment terms with a
// custom entry, and the standard vendor categories (same codes as VendorCategories in the Common service).
import React, { useMemo, useState } from "react";
import { PlusIcon, StarIcon, TrashIcon } from "@heroicons/react/24/outline";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { t } from "../../i18n/i18n";
import { limitPhoneInput, phoneProblem } from "../../utils/phone";
import {
  CUSTOM_PAYMENT_TERM,
  PAYMENT_TERM_MAX_LENGTH,
  usePaymentTermOptions,
  withAdvanceTerms,
} from "../../utils/paymentTerms";

export const VENDOR_CATEGORIES: { value: string; label: string }[] = [
  { value: "RAW_MATERIALS", label: "Raw materials" },
  { value: "TRADING_GOODS", label: "Trading goods / finished goods" },
  { value: "PACKAGING", label: "Packaging materials" },
  { value: "CONSUMABLES", label: "Consumables & spares" },
  { value: "CAPITAL_EQUIPMENT", label: "Capital equipment & machinery" },
  { value: "SERVICES", label: "Services" },
  { value: "SUBCONTRACTOR", label: "Contractor / subcontractor" },
  { value: "PROFESSIONAL_SERVICES", label: "Professional services (legal, audit, consulting)" },
  { value: "LOGISTICS", label: "Logistics & freight" },
  { value: "IT_SOFTWARE", label: "IT & software" },
  { value: "MAINTENANCE", label: "Maintenance & repairs" },
  { value: "OFFICE_SUPPLIES", label: "Office supplies" },
  { value: "UTILITIES", label: "Utilities & telecom" },
  { value: "RENT_FACILITIES", label: "Rent & facilities" },
  { value: "MARKETING", label: "Marketing & advertising" },
  { value: "GOVERNMENT", label: "Government / regulatory" },
  { value: "OTHER", label: "Other" },
];

export const vendorCategoryLabel = (code: unknown): string =>
  VENDOR_CATEGORIES.find((c) => c.value === code)?.label ?? (code ? String(code) : "");

export interface VendorContactRow {
  name: string;
  email: string;
  phone: string;
  primary: boolean;
}

export const EMPTY_CONTACT: VendorContactRow = { name: "", email: "", phone: "", primary: true };

const isFilled = (row: VendorContactRow) => Boolean(row.name.trim() || row.email.trim() || row.phone.trim());

/** The vendor's contacts as rows; vendors saved before the list come back with their single contact. */
export const vendorContactRows = (row: Record<string, unknown>): VendorContactRow[] => {
  const list = (Array.isArray(row.contacts) ? row.contacts : [])
    .map((c: Record<string, unknown>) => ({
      name: String(c?.name ?? ""),
      email: String(c?.email ?? ""),
      phone: String(c?.phone ?? ""),
      primary: Boolean(c?.primary),
    }))
    .filter(isFilled);
  if (!list.length) {
    const single = { name: String(row.contactName ?? ""), email: String(row.contactEmail ?? ""), phone: String(row.contactPhone ?? ""), primary: true };
    return [isFilled(single) ? single : { ...EMPTY_CONTACT }];
  }
  if (!list.some((c) => c.primary)) list[0] = { ...list[0], primary: true };
  return list;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first problem in the contact rows ("Contact 2: ..."), or null. The service applies the same rules. */
export const vendorContactsProblem = (rows: unknown): string | null => {
  const list = (Array.isArray(rows) ? rows : []) as VendorContactRow[];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const email = row.email.trim();
    const phone = row.phone.trim();
    const where = list.length > 1 ? `${t("Contact {n}", { n: i + 1 })}: ` : "";
    if (row.name.trim().length > 100) return `${where}${t("Keep the name to 100 characters")}`;
    if (email && !EMAIL_PATTERN.test(email)) return `${where}${t("Enter a valid email address")}`;
    const problem = phone ? phoneProblem(phone) : null;
    if (problem) return `${where}${t(problem)}`;
  }
  return null;
};

/** Contact people: name, email and phone per row; the starred one is the vendor's primary contact. */
export const VendorContactsControl: React.FC<{
  value: unknown;
  setValue: (rows: VendorContactRow[]) => void;
}> = ({ value, setValue }) => {
  const rows = (Array.isArray(value) && value.length ? value : [{ ...EMPTY_CONTACT }]) as VendorContactRow[];
  const setRow = (index: number, patch: Partial<VendorContactRow>) =>
    setValue(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    if (next.length && !next.some((r) => r.primary)) next[0] = { ...next[0], primary: true };
    setValue(next.length ? next : [{ ...EMPTY_CONTACT }]);
  };
  return (
    <div>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-1 items-start gap-x-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <FloatingInput
            label={t(row.primary && rows.length > 1 ? "Contact person (primary)" : "Contact person")}
            value={row.name}
            onChange={(e) => setRow(index, { name: e.target.value })}
            maxLength={100}
          />
          <FloatingInput
            label={t("Email")}
            type="email"
            value={row.email}
            onChange={(e) => setRow(index, { email: e.target.value.toLowerCase() })}
            maxLength={120}
          />
          <FloatingInput
            label={t("Phone")}
            type="tel"
            inputMode="tel"
            value={row.phone}
            onChange={(e) => setRow(index, { phone: limitPhoneInput(e.target.value) })}
            maxLength={25}
          />
          <div className="flex h-11 items-center gap-0.5">
            <button
              type="button"
              title={t(row.primary ? "Primary" : "Make primary")}
              aria-pressed={row.primary}
              onClick={() => setValue(rows.map((r, i) => ({ ...r, primary: i === index })))}
              className={`rounded-md p-1.5 ${row.primary ? "text-amber-500" : "text-gray-400 hover:bg-cyan-50 hover:text-cyan-700"}`}
            >
              <StarIcon className={`h-4 w-4 ${row.primary ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              title={t("Remove contact")}
              onClick={() => remove(index)}
              disabled={rows.length === 1 && !isFilled(row)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setValue([...rows, { name: "", email: "", phone: "", primary: false }])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-400"
      >
        <PlusIcon className="h-4 w-4" />
        {t("Add contact")}
      </button>
    </div>
  );
};

/** Payment terms: the company's terms, the advance-payment ones, or a custom term typed in. */
export const PaymentTermsControl: React.FC<{
  label: string;
  value: unknown;
  setValue: (value: string) => void;
}> = ({ label, value, setValue }) => {
  const current = String(value ?? "");
  const company = usePaymentTermOptions();
  const options = useMemo(() => withAdvanceTerms(company), [company]);
  const [customChosen, setCustomChosen] = useState(false);
  const isCustom = customChosen || (current.trim() !== "" && !options.some((o) => o.id === current));
  return (
    <div>
      <FloatingSelect1
        label={label}
        value={isCustom ? CUSTOM_PAYMENT_TERM : current}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_PAYMENT_TERM) {
            setCustomChosen(true);
            if (options.some((o) => o.id === current)) setValue("");
            return;
          }
          setCustomChosen(false);
          setValue(next);
        }}
        options={[...options, { id: CUSTOM_PAYMENT_TERM, name: "Custom…" }]}
        emptyOptionLabel="Select Payment Terms"
      />
      {isCustom && (
        <FloatingInput
          label={t("Custom payment terms")}
          example={t("e.g. 30% advance, 70% on delivery")}
          value={current}
          onChange={(e) => setValue(e.target.value)}
          maxLength={PAYMENT_TERM_MAX_LENGTH}
        />
      )}
    </div>
  );
};
