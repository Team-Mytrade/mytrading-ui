// The signed-in user's own settings (user-service /v1/api/user/preferences/me): language, time zone, date and time
// format, theme and notification emails. Each one left empty follows the company's regional settings; the theme
// then stays as this browser has it. Loaded with the company profile when a page layout opens.
import axios, { AxiosRequestConfig } from "axios";
import { setPersonalRegional } from "../company/format";
import { applyThemePreference } from "../context/themePreference";
import { clearLanguageChoice, Language, setLanguage } from "../i18n/i18n";

const API = "/v1/api/user/preferences/me";

export interface UserPreferences {
  language: Language | null;
  timeZone: string | null;
  dateFormat: string | null;
  timeFormat: "12h" | "24h" | null;
  theme: "light" | "dark" | null;
  emailNotifications: boolean | null;
  // What "company default" means for each (read only)
  company?: { language: string; timeZone: string; dateFormat: string; timeFormat: string } | null;
}

export const NO_PREFERENCES: UserPreferences = {
  language: null, timeZone: null, dateFormat: null, timeFormat: null, theme: null, emailNotifications: null,
};

let current: UserPreferences | null = null;
let loadedFor: string | null = null;
let loading: Promise<UserPreferences | null> | null = null;

// Who is signed in (the token's subject), so another user on the same browser gets their own settings
const signedInAs = (): string | null => {
  try {
    const token = localStorage.getItem("accessToken");
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")));
    return json.sub ?? json.userId ?? null;
  } catch {
    return null;
  }
};

/** Shows the settings: dates and times, language and theme follow them. */
const apply = (preferences: UserPreferences) => {
  current = preferences;
  setPersonalRegional({ timeZone: preferences.timeZone ?? undefined, dateFormat: preferences.dateFormat ?? undefined,
    timeFormat: preferences.timeFormat ?? undefined });
  if (preferences.language) setLanguage(preferences.language);
  else clearLanguageChoice();
  applyThemePreference(preferences.theme);
};

/** The user's settings, fetched once per signed-in user; null when they can't be read (company settings apply). */
export const loadPreferences = (): Promise<UserPreferences | null> => {
  const who = signedInAs();
  if (!who) return Promise.resolve(null);
  if (loadedFor === who && current) return Promise.resolve(current);
  if (loading && loadedFor === who) return loading;
  loadedFor = who;
  loading = axios.get<UserPreferences>(API)
    .then((r) => {
      apply({ ...NO_PREFERENCES, ...r.data });
      return current;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
};

export const savePreferences = (preferences: UserPreferences): Promise<UserPreferences> =>
  axios.put<UserPreferences>(API, preferences).then((r) => {
    loadedFor = signedInAs();
    apply({ ...NO_PREFERENCES, ...r.data });
    return current as UserPreferences;
  });

/** Signed out: the company's settings apply again. */
export const forgetPreferences = () => {
  current = null;
  loadedFor = null;
  setPersonalRegional(null);
};

// The header's language and theme buttons keep their choice in the user's settings (quietly: no toast)
const remember = (change: Partial<UserPreferences>) => {
  if (!signedInAs()) return;
  const base = current ?? NO_PREFERENCES;
  const next = { ...base, ...change };
  current = next;
  axios.put(API, next, { quiet: true } as AxiosRequestConfig).catch(() => undefined);
};

export const rememberLanguage = (language: Language) => remember({ language });
export const rememberTheme = (theme: "light" | "dark") => remember({ theme });
