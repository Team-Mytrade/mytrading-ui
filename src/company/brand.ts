// The company's branding on screen: its colour becomes the app's accent (every cyan shade and the teal buttons,
// through the --brand-50…950 variables Tailwind and the stylesheets read) and its tab icon (else its logo) becomes
// the favicon. Without a colour the standard cyan shows. The colour is remembered on this browser so a reload
// doesn't flash the standard one first.
import axios from "axios";

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const STORAGE_KEY = "mytrade.brandColor";
const DEFAULT_FAVICON = "./favicon.ico";

// How far each shade moves from the brand colour (600): towards white for light ones, black for dark ones
const MIX: Record<number, [number, number]> = {
  50: [0.94, 0], 100: [0.86, 0], 200: [0.72, 0], 300: [0.52, 0], 400: [0.3, 0], 500: [0.12, 0], 600: [0, 0],
  700: [0, 0.18], 800: [0, 0.34], 900: [0, 0.46], 950: [0, 0.64],
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** The 50…950 shades of a colour, as "r g b" (the colour itself is 600). */
export const brandPalette = (hex: string): Record<number, string> | null => {
  const base = hexToRgb(hex);
  if (!base) return null;
  const palette: Record<number, string> = {};
  for (const step of STEPS) {
    const [white, black] = MIX[step];
    palette[step] = base
      .map((c) => Math.round(c + (255 - c) * white - c * black))
      .map((c) => Math.min(255, Math.max(0, c)))
      .join(" ");
  }
  return palette;
};

/** Applies a brand colour (#RRGGBB), or the standard cyan for none. */
export const applyBrandColor = (hex?: string | null) => {
  const root = document.documentElement;
  const palette = hex ? brandPalette(hex) : null;
  for (const step of STEPS) {
    if (palette) root.style.setProperty(`--brand-${step}`, palette[step]);
    else root.style.removeProperty(`--brand-${step}`);
  }
  try {
    if (palette && hex) localStorage.setItem(STORAGE_KEY, hex);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode: the colour shows once the company loads
  }
};

/** At start-up: the colour this browser last showed, until the company's loads. */
export const applyRememberedBrand = () => {
  try {
    const hex = localStorage.getItem(STORAGE_KEY);
    if (hex) applyBrandColor(hex);
  } catch {
    // Nothing remembered
  }
};

let faviconUrl: string | null = null;

const setFavicon = (href: string) => {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.removeAttribute("type");
  link.href = href;
};

/** The company's tab icon, else its logo, else the standard one (the images need the signed-in session). */
export const applyFavicon = async (company: { hasFavicon?: boolean; hasLogo?: boolean } | null) => {
  const source = company?.hasFavicon ? "/v1/api/user/company/favicon" : company?.hasLogo ? "/v1/api/user/company/logo" : null;
  if (faviconUrl) {
    URL.revokeObjectURL(faviconUrl);
    faviconUrl = null;
  }
  if (!source) {
    setFavicon(DEFAULT_FAVICON);
    return;
  }
  try {
    const res = await axios.get<Blob>(source, { responseType: "blob" });
    faviconUrl = URL.createObjectURL(res.data);
    setFavicon(faviconUrl);
  } catch {
    setFavicon(DEFAULT_FAVICON);
  }
};

/** Both, from the company profile; null (signed out, another company) goes back to the standard look. */
export const applyCompanyBranding = (company: { brandColor?: string | null; hasFavicon?: boolean; hasLogo?: boolean } | null) => {
  applyBrandColor(company?.brandColor ?? null);
  applyFavicon(company);
};

// The standard cyan, for PDFs when the company has no colour
const STANDARD: Record<number, [number, number, number]> = {
  50: [236, 254, 255], 100: [207, 250, 254], 200: [165, 243, 252], 300: [103, 232, 249], 400: [34, 211, 238],
  500: [6, 182, 212], 600: [8, 145, 178], 700: [14, 116, 144], 800: [21, 94, 117], 900: [22, 78, 99], 950: [8, 51, 68],
};

/** A shade of the brand colour as [r, g, b] for PDFs (jsPDF takes numbers): 600 is the colour itself. */
export const brandShade = (step: (typeof STEPS)[number] = 600): [number, number, number] => {
  const value = document.documentElement.style.getPropertyValue(`--brand-${step}`).trim();
  const parts = value.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? [parts[0], parts[1], parts[2]] : STANDARD[step];
};
