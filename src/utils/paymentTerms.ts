// Payment terms for the customer and vendor forms: the company's own list (Invoice → Payment Terms), saved by
// its term code (NET30, TEST-75...). Customers and vendors use the same list and the same codes, which the
// importers and the due-date calculations read too.
import { useEffect, useState } from "react";
import axios from "axios";

export const PAYMENT_TERMS_API = "/v1/api/invoice/payment-terms";

export interface PaymentTermRow {
  id?: number;
  termCode?: string | null;
  description?: string | null;
  dueDays?: number | null;
}

export interface PaymentTermOption {
  id: string;
  name: string;
}

// Shown when the list can't be read (no access to Invoice, or the service is down); the codes the importers accept
export const STANDARD_PAYMENT_TERMS: PaymentTermOption[] = [
  { id: "IMMEDIATE", name: "Due on receipt" },
  { id: "NET15", name: "Net 15 days" },
  { id: "NET30", name: "Net 30 days" },
  { id: "NET45", name: "Net 45 days" },
  { id: "NET60", name: "Net 60 days" },
  { id: "NET90", name: "Net 90 days" },
];

export const DEFAULT_PAYMENT_TERM = "NET30";

/** "TEST-75 — 75 days" (or the term's description when it has one). */
export const paymentTermLabel = (row: PaymentTermRow): string => {
  const code = String(row.termCode ?? "").trim();
  const description = String(row.description ?? "").trim();
  const days = row.dueDays != null ? (row.dueDays === 0 ? "due on receipt" : `${row.dueDays} days`) : "";
  if (description) return days && !description.includes(String(row.dueDays)) ? `${description} (${days})` : description;
  return days ? `${code} — ${days}` : code;
};

/** The company's terms as options, sorted by days; [] when there are none. */
export const paymentTermOptionsOf = (rows: unknown): PaymentTermOption[] =>
  (Array.isArray(rows) ? (rows as PaymentTermRow[]) : [])
    .filter((row) => String(row.termCode ?? "").trim())
    .sort((a, b) => (a.dueDays ?? 0) - (b.dueDays ?? 0))
    .map((row) => ({ id: String(row.termCode).trim(), name: paymentTermLabel(row) }));

/** Adds a stored value that isn't in the list (older records saved free text such as "30 Days"). */
export const withStoredTerm = (options: PaymentTermOption[], stored?: string | null): PaymentTermOption[] => {
  const value = String(stored ?? "").trim();
  return value && !options.some((o) => o.id === value) ? [...options, { id: value, name: value }] : options;
};

/** The company's payment terms (the standard list when they can't be read or none are set up). */
export const usePaymentTermOptions = (): PaymentTermOption[] => {
  const [options, setOptions] = useState<PaymentTermOption[]>(STANDARD_PAYMENT_TERMS);
  useEffect(() => {
    let live = true;
    axios
      .get(PAYMENT_TERMS_API)
      .then((res) => {
        const list = paymentTermOptionsOf(Array.isArray(res.data) ? res.data : res.data?.content);
        if (live && list.length) setOptions(list);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return options;
};
