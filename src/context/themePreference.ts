// The signed-in user's saved theme (My Preferences) reaches the ThemeProvider as this event.
export const THEME_PREFERENCE = "app-theme-preference";

export type ThemeName = "light" | "dark";

/** Shows the user's saved theme (a null theme keeps this browser's). */
export const applyThemePreference = (theme: string | null | undefined) => {
  if (theme === "light" || theme === "dark") {
    window.dispatchEvent(new CustomEvent<ThemeName>(THEME_PREFERENCE, { detail: theme }));
  }
};
