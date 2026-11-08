import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CalendarDays, PartyPopper } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { todayIso } from "../../utils/localDate";
import { formatDate, formatHijri, hijriEnabled, liveMonthNames, weekdayName } from "../../company/format";
import { apiError } from "./attendanceApi";
import { t } from "../../i18n/i18n";
import type { HolidayCalendarModel, HolidayItem } from "./HolidayCalendarPage";

// What employees see: the company's holidays for the year, read-only. HR maintains them in the
// Holiday Calendar Master (same route, shown to users who can create or change calendars).
const BASE_CALENDAR_URL = "/v1/api/attendance/holiday-calendars";

const TYPE_STYLE: Record<string, string> = {
  NATIONAL: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  STATE: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30",
  FESTIVAL: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
};
const TYPE_LABEL: Record<string, string> = { NATIONAL: "National", STATE: "Regional", FESTIVAL: "Festival" };

const dayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const HolidayListView: React.FC = () => {
  const [calendars, setCalendars] = useState<HolidayCalendarModel[]>([]);
  const [calendarId, setCalendarId] = useState<number | null>(null);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const months = liveMonthNames("long");

  useEffect(() => {
    axios.get(BASE_CALENDAR_URL)
      .then((res) => {
        const active = (Array.isArray(res.data) ? res.data : [])
          .filter((c: HolidayCalendarModel) => c.active !== false && c.id != null)
          .sort((a: HolidayCalendarModel, b: HolidayCalendarModel) => b.calendarYear - a.calendarYear);
        setCalendars(active);
        // Open on this year's calendar, else the nearest one
        const current = active.find((c: HolidayCalendarModel) => c.calendarYear === thisYear) ?? active[0];
        setCalendarId(current?.id ?? null);
        if (!current) setLoading(false);
      })
      .catch((err) => {
        ToasterService.error(apiError(err, "Failed to load the holiday calendar"));
        setLoading(false);
      });
  }, [thisYear]);

  useEffect(() => {
    if (calendarId == null) return;
    setLoading(true);
    axios.get(`${BASE_CALENDAR_URL}/${calendarId}/holidays`)
      .then((res) => setHolidays((Array.isArray(res.data) ? res.data : [])
        .filter((h: HolidayItem) => h.active !== false && h.holidayDate)
        .sort((a: HolidayItem, b: HolidayItem) => a.holidayDate.localeCompare(b.holidayDate))))
      .catch((err) => ToasterService.error(apiError(err, "Failed to load holidays")))
      .finally(() => setLoading(false));
  }, [calendarId]);

  const calendar = calendars.find((c) => c.id === calendarId);
  const upcoming = holidays.filter((h) => h.holidayDate >= today);
  const next = upcoming[0];
  const daysToNext = next ? Math.round((dayOf(next.holidayDate).getTime() - dayOf(today).getTime()) / 86400000) : null;

  const byMonth = useMemo(() => {
    const groups = new Map<number, HolidayItem[]>();
    holidays.forEach((h) => {
      const m = Number(h.holidayDate.slice(5, 7)) - 1;
      groups.set(m, [...(groups.get(m) ?? []), h]);
    });
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [holidays]);

  // Only when there is a real choice: other years, or more than one calendar in use
  const showPicker = calendars.length > 1;

  return (
    <>
      <PageMeta title={t("Holiday Calendar")} description={t("Company holidays for the year")} />
      <PageBreadcrumb pageTitle={t("Holiday Calendar")} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {calendar ? calendar.calendarName : t("Holiday Calendar")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {calendar
                  ? `${holidays.length} ${t("holidays")} · ${upcoming.length} ${t("still to come")}`
                  : t("No holiday calendar has been published yet")}
              </p>
            </div>
          </div>
          {showPicker && (
            <select
              aria-label={t("Year")}
              value={calendarId ?? ""}
              onChange={(e) => setCalendarId(Number(e.target.value))}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>{c.calendarYear} · {c.calendarName}</option>
              ))}
            </select>
          )}
        </div>

        {next && (
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/30 dark:bg-cyan-500/10">
            <PartyPopper className="h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" />
            <p className="text-sm text-gray-800 dark:text-gray-100">
              <span className="font-semibold">{t("Next holiday")}:</span> {next.holidayName} — {weekdayName(dayOf(next.holidayDate), "long")}, {formatDate(next.holidayDate)}
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                ({daysToNext === 0 ? t("today") : daysToNext === 1 ? t("tomorrow") : `${t("in")} ${daysToNext} ${t("days")}`})
              </span>
            </p>
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">{t("Loading…")}</p>
        ) : holidays.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-700">
            {t("No holidays in this calendar")}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {byMonth.map(([month, items]) => (
              <section key={month} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <h3 className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  {months[month]}
                </h3>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((h) => {
                    const past = h.holidayDate < today;
                    const type = (h.holidayType || "").toUpperCase();
                    return (
                      <li key={h.id ?? h.holidayDate + h.holidayName} className={`flex items-center gap-3 px-4 py-3 ${past ? "opacity-50" : ""}`}>
                        <div className="w-11 shrink-0 text-center">
                          <div className="text-lg font-semibold leading-none text-gray-900 dark:text-white">{Number(h.holidayDate.slice(8, 10))}</div>
                          <div className="mt-0.5 text-[10px] uppercase text-gray-500">{weekdayName(dayOf(h.holidayDate), "short")}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{h.holidayName}</p>
                          {hijriEnabled() && <p className="text-[11px] text-gray-500">{formatHijri(h.holidayDate)}</p>}
                          {h.description && <p className="truncate text-xs text-gray-500">{h.description}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {TYPE_STYLE[type] && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TYPE_STYLE[type]}`}>
                              {t(TYPE_LABEL[type])}
                            </span>
                          )}
                          {h.optionalHoliday && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              {t("Optional")}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default HolidayListView;
