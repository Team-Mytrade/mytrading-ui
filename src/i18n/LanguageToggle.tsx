import { setLanguage, t, useLanguage } from "./i18n";

/**
 * Header button switching the screens between English and Arabic for this user on this browser
 * (the company's language applies until one is chosen).
 */
export default function LanguageToggle() {
  const lang = useLanguage();
  const next = lang === "ar" ? "en" : "ar";
  const label = next === "ar" ? "العربية" : "English";
  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      title={t("Switch the screens to {language}", { language: label })}
      aria-label={t("Switch the screens to {language}", { language: label })}
      className="flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
    >
      {next === "ar" ? "ع" : "EN"}
    </button>
  );
}
