import { hijriEnabled, hijriMonthSpan } from "../../company/format";

/** The Hijri month(s) under a calendar's month title, when the company shows Hijri dates (month is 0-based). */
export default function HijriMonthCaption({ year, month }: { year: number; month: number }) {
  if (!hijriEnabled()) return null;
  return (
    <span className="block text-[9.5px] font-medium normal-case tracking-normal text-slate-500 dark:text-gray-400">
      {hijriMonthSpan(year, month)}
    </span>
  );
}
