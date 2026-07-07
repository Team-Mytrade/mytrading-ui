export interface CountryOption {
  code: string;      // ISO 3166-1 alpha-2
  dialCode: string;  // e.g. "+91"
  name: string;
  taxLabel: string;  // Local name for the tax/VAT/GST identifier
}

export const COUNTRIES: CountryOption[] = [
  { code: "IN", dialCode: "+91",  name: "India",          taxLabel: "GST Number" },
  { code: "US", dialCode: "+1",   name: "United States",  taxLabel: "EIN / Tax ID" },
  { code: "GB", dialCode: "+44",  name: "United Kingdom", taxLabel: "VAT Number" },
  { code: "AE", dialCode: "+971", name: "UAE",            taxLabel: "TRN" },
  { code: "SG", dialCode: "+65",  name: "Singapore",      taxLabel: "GST Number" },
  { code: "AU", dialCode: "+61",  name: "Australia",      taxLabel: "ABN" },
  { code: "CA", dialCode: "+1",   name: "Canada",         taxLabel: "GST/HST Number" },
  { code: "DE", dialCode: "+49",  name: "Germany",        taxLabel: "USt-IdNr (VAT ID)" },
  { code: "FR", dialCode: "+33",  name: "France",         taxLabel: "TVA (VAT Number)" },
  { code: "NL", dialCode: "+31",  name: "Netherlands",    taxLabel: "BTW (VAT Number)" },
  { code: "IT", dialCode: "+39",  name: "Italy",          taxLabel: "Partita IVA" },
  { code: "ES", dialCode: "+34",  name: "Spain",          taxLabel: "NIF/CIF (VAT)" },
  { code: "CN", dialCode: "+86",  name: "China",          taxLabel: "Tax ID" },
  { code: "JP", dialCode: "+81",  name: "Japan",          taxLabel: "Corporate Number" },
  { code: "KR", dialCode: "+82",  name: "South Korea",    taxLabel: "Business Reg. Number" },
  { code: "BR", dialCode: "+55",  name: "Brazil",         taxLabel: "CNPJ" },
  { code: "MX", dialCode: "+52",  name: "Mexico",         taxLabel: "RFC" },
  { code: "ZA", dialCode: "+27",  name: "South Africa",   taxLabel: "VAT Number" },
  { code: "SA", dialCode: "+966", name: "Saudi Arabia",   taxLabel: "VAT Number" },
  { code: "MY", dialCode: "+60",  name: "Malaysia",       taxLabel: "SST Number" },
  { code: "ID", dialCode: "+62",  name: "Indonesia",      taxLabel: "NPWP" },
  { code: "TH", dialCode: "+66",  name: "Thailand",       taxLabel: "Tax ID" },
  { code: "PH", dialCode: "+63",  name: "Philippines",    taxLabel: "TIN" },
  { code: "VN", dialCode: "+84",  name: "Vietnam",        taxLabel: "Tax Code" },
  { code: "PK", dialCode: "+92",  name: "Pakistan",       taxLabel: "NTN" },
  { code: "BD", dialCode: "+880", name: "Bangladesh",     taxLabel: "BIN" },
  { code: "LK", dialCode: "+94",  name: "Sri Lanka",      taxLabel: "VAT Number" },
  { code: "NP", dialCode: "+977", name: "Nepal",          taxLabel: "PAN" },
  { code: "NZ", dialCode: "+64",  name: "New Zealand",    taxLabel: "GST Number" },
  { code: "IE", dialCode: "+353", name: "Ireland",        taxLabel: "VAT Number" },
];