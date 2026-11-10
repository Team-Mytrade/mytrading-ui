import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "../../i18n/i18n";

/** "2026-11" moved by {@code delta} months. */
const shiftMonth = (month: string, delta: number) => {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
const thisMonth = () => {
  const d = new Date();
  return ym(d.getFullYear(), d.getMonth() + 1);
};
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString("en", { month: "short" }));
const YEARS_PER_PAGE = 12;

interface MonthSwitcherProps {
  /** The month shown, as "YYYY-MM". */
  value: string;
  onChange: (month: string) => void;
  /** Latest month that can be chosen ("YYYY-MM"), e.g. the current month. */
  max?: string;
  ariaLabel?: string;
}

const ARROW =
  "rounded-full p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-[#2a2a2a] dark:hover:text-white";

const cell = (selected: boolean, current: boolean) =>
  `h-9 rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-gray-600 ${
    selected
      ? "bg-cyan-600 font-semibold text-white hover:bg-cyan-700"
      : `text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 dark:text-gray-200 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 ${current ? "font-semibold ring-1 ring-inset ring-cyan-400" : ""}`
  }`;

/**
 * A month picker as a pill: ‹ NOVEMBER 2026 ›. The arrows step a month; clicking the month opens a panel of the
 * year's months, and clicking the year there switches to a panel of years, laid out the same way.
 */
const MonthSwitcher: React.FC<MonthSwitcherProps> = ({ value, onChange, max, ariaLabel }) => {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"months" | "years">("months");
  const [year, m] = (value || thisMonth()).split("-").map(Number);
  const [shownYear, setShownYear] = useState(year);
  const label = value ? new Date(year, m - 1, 1).toLocaleString("en", { month: "long", year: "numeric" }) : t("Choose a month");
  const atMax = !!max && !!value && value >= max;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;
  const today = thisMonth();
  const firstYear = shownYear - (((shownYear % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE);

  // Close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setShownYear(year);
    setView("months");
    setOpen((o) => !o);
  };
  const pick = (month: string) => {
    onChange(month);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative inline-block">
      <div
        role="group"
        aria-label={ariaLabel ?? t("Month")}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-1.5 shadow-2xs dark:border-gray-700 dark:bg-[#191919]"
      >
        <button type="button" onClick={() => value && onChange(shiftMonth(value, -1))} className={ARROW}
          title={t("Previous month")} aria-label={t("Previous month")}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="min-w-[132px] rounded-full px-2 text-center text-xs font-bold uppercase tracking-wider text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-white"
          title={t("Choose a month")}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-live="polite"
        >
          {label}
        </button>
        <button type="button" onClick={() => value && !atMax && onChange(shiftMonth(value, 1))} disabled={atMax}
          className={ARROW} title={t("Next month")} aria-label={t("Next month")}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={view === "months" ? t("Choose a month") : t("Choose a year")}
          className="absolute left-1/2 top-10 z-50 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-[#191919]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className={ARROW}
              onClick={() => setShownYear((y) => y - (view === "months" ? 1 : YEARS_PER_PAGE))}
              aria-label={view === "months" ? t("Previous year") : t("Earlier years")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {view === "months" ? (
              <button
                type="button"
                onClick={() => setView("years")}
                className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-white dark:hover:bg-cyan-950/40"
                title={t("Choose a year")}
              >
                {shownYear}
              </button>
            ) : (
              <span className="px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white">
                {firstYear} – {firstYear + YEARS_PER_PAGE - 1}
              </span>
            )}
            <button
              type="button"
              className={ARROW}
              onClick={() => setShownYear((y) => y + (view === "months" ? 1 : YEARS_PER_PAGE))}
              disabled={view === "months" ? shownYear >= maxYear : firstYear + YEARS_PER_PAGE > maxYear}
              aria-label={view === "months" ? t("Next year") : t("Later years")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {view === "months"
              ? MONTHS.map((name, i) => {
                  const month = ym(shownYear, i + 1);
                  return (
                    <button key={name} type="button" onClick={() => pick(month)} disabled={!!max && month > max}
                      className={cell(month === value, month === today)} aria-pressed={month === value}>
                      {name}
                    </button>
                  );
                })
              : Array.from({ length: YEARS_PER_PAGE }, (_, i) => firstYear + i).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setShownYear(y);
                      setView("months");
                    }}
                    disabled={y > maxYear}
                    className={cell(y === year, y === Number(today.slice(0, 4)))}
                    aria-pressed={y === year}
                  >
                    {y}
                  </button>
                ))}
          </div>

          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2 dark:border-gray-800">
            <button
              type="button"
              onClick={() => pick(max && today > max ? max : today)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-400 dark:hover:bg-cyan-950/40"
            >
              {t("This month")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthSwitcher;
