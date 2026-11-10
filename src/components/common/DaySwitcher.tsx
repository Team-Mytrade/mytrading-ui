import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "../../i18n/i18n";
import { todayIso } from "../../utils/localDate";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parse = (value: string) => value.split("-").map(Number) as [number, number, number];
/** "2026-11-10" moved by {@code delta} days. */
const shiftDay = (value: string, delta: number) => {
  const [y, m, d] = parse(value);
  const date = new Date(y, m - 1, d + delta);
  return iso(date.getFullYear(), date.getMonth() + 1, date.getDate());
};
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString("en", { month: "short" }));
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const YEARS_PER_PAGE = 12;

const ARROW =
  "rounded-full p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-[#2a2a2a] dark:hover:text-white";
const cell = (selected: boolean, current: boolean, muted = false) =>
  `rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-gray-600 ${
    selected
      ? "bg-cyan-600 font-semibold text-white hover:bg-cyan-700"
      : `${muted ? "text-slate-400 dark:text-gray-500" : "text-slate-700 dark:text-gray-200"} hover:bg-cyan-50 hover:text-cyan-800 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 ${current ? "font-semibold ring-1 ring-inset ring-cyan-400" : ""}`
  }`;

interface DaySwitcherProps {
  /** The day shown, as "YYYY-MM-DD". */
  value: string;
  onChange: (day: string) => void;
  /** Latest day that can be chosen ("YYYY-MM-DD"), e.g. today. */
  max?: string;
  ariaLabel?: string;
}

/**
 * A date picker as a pill: ‹ 10 NOV 2026 ›. The arrows step a day; clicking the date opens a month's calendar,
 * its title opens the months, and the year opens a grid of years, the same way as the month switcher.
 */
const DaySwitcher: React.FC<DaySwitcherProps> = ({ value, onChange, max, ariaLabel }) => {
  const root = useRef<HTMLDivElement>(null);
  const today = todayIso();
  const [y, m, d] = parse(value || today);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [shownYear, setShownYear] = useState(y);
  const [shownMonth, setShownMonth] = useState(m);
  const label = new Date(y, m - 1, d).toLocaleString("en", { day: "2-digit", month: "short", year: "numeric", weekday: "short" });
  const atMax = !!max && !!value && value >= max;
  const firstYear = shownYear - (((shownYear % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE);
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;
  const maxMonth = max ? max.slice(0, 7) : "9999-12";

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
    setShownYear(y);
    setShownMonth(m);
    setView("days");
    setOpen((o) => !o);
  };
  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };
  const stepMonth = (delta: number) => {
    const date = new Date(shownYear, shownMonth - 1 + delta, 1);
    setShownYear(date.getFullYear());
    setShownMonth(date.getMonth() + 1);
  };

  // The month's days in Monday-first weeks, with the neighbouring months' days greyed out
  const firstWeekday = (new Date(shownYear, shownMonth - 1, 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(shownYear, shownMonth - 1, i - firstWeekday + 1);
    return { day: iso(date.getFullYear(), date.getMonth() + 1, date.getDate()), n: date.getDate(), inMonth: date.getMonth() === shownMonth - 1 };
  });
  const weeks = days.slice(35).every((x) => !x.inMonth) ? days.slice(0, 35) : days;
  const nextDisabled = view === "days" ? `${shownYear}-${pad(shownMonth)}` >= maxMonth
    : view === "months" ? shownYear >= maxYear : firstYear + YEARS_PER_PAGE > maxYear;

  return (
    <div ref={root} className="relative inline-block">
      <div role="group" aria-label={ariaLabel ?? t("Date")}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-1.5 shadow-2xs dark:border-gray-700 dark:bg-[#191919]">
        <button type="button" onClick={() => onChange(shiftDay(value || today, -1))} className={ARROW} title={t("Previous day")} aria-label={t("Previous day")}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-live="polite" title={t("Choose a date")}
          className="min-w-[150px] rounded-full px-2 text-center text-xs font-bold uppercase tracking-wider text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-white">
          {label}
        </button>
        <button type="button" onClick={() => !atMax && onChange(shiftDay(value || today, 1))} disabled={atMax} className={ARROW}
          title={t("Next day")} aria-label={t("Next day")}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div role="dialog" aria-label={t("Choose a date")}
          className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-[#191919]">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className={ARROW} aria-label={t("Previous")}
              onClick={() => (view === "days" ? stepMonth(-1) : setShownYear((v) => v - (view === "months" ? 1 : YEARS_PER_PAGE)))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            {view === "days" && (
              <button type="button" onClick={() => setView("months")} title={t("Choose a month")}
                className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-cyan-50 hover:text-cyan-800 dark:text-white dark:hover:bg-cyan-950/40">
                {new Date(shownYear, shownMonth - 1, 1).toLocaleString("en", { month: "long", year: "numeric" })}
              </button>
            )}
            {view === "months" && (
              <button type="button" onClick={() => setView("years")} title={t("Choose a year")}
                className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-cyan-50 hover:text-cyan-800 dark:text-white dark:hover:bg-cyan-950/40">
                {shownYear}
              </button>
            )}
            {view === "years" && <span className="px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white">{firstYear} – {firstYear + YEARS_PER_PAGE - 1}</span>}
            <button type="button" className={ARROW} aria-label={t("Next")} disabled={nextDisabled}
              onClick={() => (view === "days" ? stepMonth(1) : setShownYear((v) => v + (view === "months" ? 1 : YEARS_PER_PAGE)))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {view === "days" && (
            <>
              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-400 dark:text-gray-500">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {weeks.map((x) => (
                  <button key={x.day} type="button" onClick={() => pick(x.day)} disabled={!!max && x.day > max} aria-pressed={x.day === value}
                    className={`h-8 ${cell(x.day === value, x.day === today, !x.inMonth)}`}>
                    {x.n}
                  </button>
                ))}
              </div>
            </>
          )}
          {view === "months" && (
            <div className="grid grid-cols-4 gap-1">
              {MONTHS.map((name, i) => {
                const month = `${shownYear}-${pad(i + 1)}`;
                return (
                  <button key={name} type="button" disabled={month > maxMonth} aria-pressed={shownYear === y && i + 1 === m}
                    onClick={() => { setShownMonth(i + 1); setView("days"); }}
                    className={`h-9 ${cell(shownYear === y && i + 1 === m, month === today.slice(0, 7))}`}>
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          {view === "years" && (
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: YEARS_PER_PAGE }, (_, i) => firstYear + i).map((year) => (
                <button key={year} type="button" disabled={year > maxYear} aria-pressed={year === y}
                  onClick={() => { setShownYear(year); setView("months"); }}
                  className={`h-9 ${cell(year === y, year === Number(today.slice(0, 4)))}`}>
                  {year}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2 dark:border-gray-800">
            <button type="button" onClick={() => pick(max && today > max ? max : today)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/40">
              {t("Today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DaySwitcher;
