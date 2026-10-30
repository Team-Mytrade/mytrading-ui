// The signed-in company's details (user-service /v1/api/user/company): Company Settings and document headers.
import { useEffect, useState } from "react";
import axios from "axios";
import { decodeAccess, getSelectedTenant } from "../access/access";
import { onRegionalChange, setRegional } from "./format";
import { addressStyle, regionalAddressLines } from "./regionalAddress";

export interface CompanyProfile {
  tenantId: string;
  companyName: string;
  legalName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  financialYearStartMonth: number;
  currency: string;
  // Regional settings (see regional.ts); a save that leaves one out keeps the stored value
  currencyDecimals: number;
  language: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  numberLocale: string;
  weekStart: string;
  weekendDays: string[];
  // Hijri dates beside the Gregorian ones (Saudi companies by default)
  hijriDates: boolean;
  // VAT (Gulf: TRN on tax invoices, VAT return), GST (India: GSTIN) or NONE (not registered)
  taxRegime?: TaxRegime;
  // VAT registration number (TRN); GST companies use gstin
  taxNumber?: string | null;
  // Commercial / trade licence and who issued it (UAE e-invoices identify the seller by them)
  tradeLicenseNumber?: string | null;
  licenseAuthority?: string | null;
  hasLogo: boolean;
  updatedDate?: string | null;
  // The signed-in user may change these details
  editable: boolean;
}

export type TaxRegime = "VAT" | "GST" | "NONE";

export interface CompanyLogo {
  dataUrl: string;
  format: "PNG" | "JPEG" | "WEBP";
  width: number;
  height: number;
}

const BASE = "/v1/api/user/company";
const CHANGED = "app-company-changed";
const FALLBACK_NAME = "My Trading";

// One fetch per company (token tenant, or the tenant a Super Admin selected)
let cacheKey: string | null = null;
let profilePromise: Promise<CompanyProfile | null> | null = null;
let logoPromise: Promise<CompanyLogo | null> | null = null;
let current: CompanyProfile | null = null;

const companyKey = () => {
  let token: string | null = null;
  try {
    token = localStorage.getItem("accessToken");
  } catch {
    token = null;
  }
  return `${decodeAccess(token).tenantId ?? ""}|${getSelectedTenant() ?? ""}`;
};

const resetIfOtherCompany = () => {
  const key = companyKey();
  if (key !== cacheKey) {
    cacheKey = key;
    profilePromise = null;
    logoPromise = null;
    current = null;
    setRegional(null);
  }
};

const changed = (profile: CompanyProfile) => {
  current = profile;
  setRegional(profile);
  profilePromise = Promise.resolve(profile);
  logoPromise = null;
  window.dispatchEvent(new Event(CHANGED));
  return profile;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const imageSize = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });

export const companyApi = {
  get: () => axios.get<CompanyProfile>(BASE).then((r) => r.data),
  update: (profile: Partial<CompanyProfile>) => axios.put<CompanyProfile>(BASE, profile).then((r) => changed(r.data)),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return axios.put<CompanyProfile>(`${BASE}/logo`, form).then((r) => changed(r.data));
  },
  removeLogo: () => axios.delete<CompanyProfile>(`${BASE}/logo`).then((r) => changed(r.data)),
};

/** The company profile, fetched once; null when it can't be read (documents then use generic headers). */
export const loadCompany = (): Promise<CompanyProfile | null> => {
  resetIfOtherCompany();
  if (!profilePromise) {
    profilePromise = companyApi.get().then(
      (profile) => {
        setRegional(profile);
        return (current = profile);
      },
      () => {
        profilePromise = null;
        return null;
      },
    );
  }
  return profilePromise;
};

/** The company's logo for PDFs and the page, or null when there is none. */
export const loadCompanyLogo = async (): Promise<CompanyLogo | null> => {
  const profile = await loadCompany();
  if (!profile?.hasLogo) return null;
  if (!logoPromise) {
    logoPromise = axios
      .get(`${BASE}/logo`, { responseType: "blob" })
      .then(async (r) => {
        const blob = r.data as Blob;
        const dataUrl = await blobToDataUrl(blob);
        const { width, height } = await imageSize(dataUrl);
        const format = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
        return { dataUrl, format, width, height } as CompanyLogo;
      })
      .catch(() => null);
  }
  return logoPromise;
};

/** Name for report headers; the last loaded profile, else a generic name. */
export const companyDisplayName = () => current?.companyName || FALLBACK_NAME;

export const companyAddressLines = (p?: CompanyProfile | null): string[] =>
  !p
    ? []
    : addressStyle(p.country) !== "OTHER"
      ? regionalAddressLines({ addressLine1: p.addressLine1 ?? "", addressLine2: p.addressLine2, city: p.city ?? "",
          state: p.state ?? "", postalCode: p.postalCode ?? "", country: p.country })
    : [
        p.addressLine1,
        p.addressLine2,
        [p.city, p.state].filter(Boolean).join(", ") + (p.postalCode ? ` - ${p.postalCode}` : ""),
        p.country && p.country !== "India" ? p.country : null,
      ]
        .map((line) => String(line ?? "").trim().replace(/^- /, ""))
        .filter(Boolean);

/** The company profile for a page; refreshes when it is saved or the company changes. */
export const useCompany = () => {
  const [company, setCompany] = useState<CompanyProfile | null>(current);
  const [logo, setLogo] = useState<CompanyLogo | null>(null);
  const [loading, setLoading] = useState(current === null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadCompany().then((profile) => {
        if (!alive) return;
        setCompany(profile);
        setLoading(false);
        loadCompanyLogo().then((l) => alive && setLogo(l));
      });
    };
    refresh();
    window.addEventListener(CHANGED, refresh);
    window.addEventListener("app-tenant-changed", refresh);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener("app-tenant-changed", refresh);
    };
  }, []);

  return { company, logo, loading };
};

/**
 * For the layouts: loads the company's regional settings before the first page shows (so pages
 * format with them), and returns a number that changes when they change later, to re-render pages.
 */
export const useRegionalVersion = (enabled: boolean): { ready: boolean; version: number } => {
  const [ready, setReady] = useState(current !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => {
      loadCompany().finally(() => alive && setReady(true));
    };
    load();
    const stop = onRegionalChange(() => alive && setVersion((v) => v + 1));
    window.addEventListener("app-tenant-changed", load);
    return () => {
      alive = false;
      stop();
      window.removeEventListener("app-tenant-changed", load);
    };
  }, [enabled]);

  return { ready, version };
};
