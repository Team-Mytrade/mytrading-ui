"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect } from "react";

type Theme = "light" | "dark";
type ThemePreference = Theme | "system";
const LOGIN_SUCCESS_EVENT = "app-login-success";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const getSystemTheme = (): Theme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const [theme, setTheme] = useState<Theme>("light");
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as ThemePreference | null;
    const initialPreference: ThemePreference =
      savedTheme === "light" || savedTheme === "dark" || savedTheme === "system"
        ? savedTheme
        : "system";
    const initialTheme =
      initialPreference === "system" ? getSystemTheme() : initialPreference;

    setTheme(initialTheme);
    setThemePreference(initialPreference);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    localStorage.setItem("theme", themePreference);

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme, themePreference, isInitialized]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (themePreference !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    setTheme(mediaQuery.matches ? "dark" : "light");

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [themePreference, isInitialized]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const syncThemeToSystem = () => {
      setThemePreference("system");
      setTheme(getSystemTheme());
    };

    window.addEventListener(LOGIN_SUCCESS_EVENT, syncThemeToSystem);

    return () => {
      window.removeEventListener(LOGIN_SUCCESS_EVENT, syncThemeToSystem);
    };
  }, [isInitialized]);

  const toggleTheme = () => {
    setThemePreference((prevPreference) => {
      const nextTheme =
        (prevPreference === "system" ? theme : prevPreference) === "dark"
          ? "light"
          : "dark";
      setTheme(nextTheme);
      return nextTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
