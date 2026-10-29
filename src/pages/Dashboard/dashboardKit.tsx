// Shared pieces of the module dashboards (Procurement, Delivery, HRMS, Attendance). Every figure on
import { t } from "../../i18n/i18n";
// those dashboards comes from the module's own API; nothing here holds sample data.
import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { formatMoney as companyMoney, formatNumber as companyNumber, formatDate as companyDate, dateLocale } from "../../company/format";

/* ================= data ================= */

export const listOf = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  const content = (data as { content?: unknown })?.content;
  return Array.isArray(content) ? (content as T[]) : [];
};

export const getList = async <T,>(url: string): Promise<T[]> => listOf<T>((await axios.get(url)).data);

/**
 * How many records a list endpoint holds without downloading them: with ?page=0&size=1 the services
 * answer {content, totalElements}. A service without pagination returns the whole list instead.
 */
export const countOf = async (url: string): Promise<number> => {
  const { data } = await axios.get(url, { params: { page: 0, size: 1 } });
  if (Array.isArray(data)) return data.length;
  const total = (data as { totalElements?: unknown })?.totalElements;
  return typeof total === "number" ? total : listOf(data).length;
};

export interface DashboardState<K extends string> {
  loading: boolean;
  data: Partial<Record<K, unknown>>;
  failed: string[];
}

/**
 * Loads every source in parallel. A source that fails (no permission, service down) is reported by
 * its label and the rest of the dashboard still shows. `sources` must be defined outside the component.
 */
export function useDashboardSources<K extends string>(
  sources: Record<K, () => Promise<unknown>>,
  labels: Record<K, string>,
): DashboardState<K> {
  const [state, setState] = useState<DashboardState<K>>({ loading: true, data: {}, failed: [] });
  useEffect(() => {
    let active = true;
    const keys = Object.keys(sources) as K[];
    Promise.allSettled(keys.map((key) => sources[key]())).then((results) => {
      if (!active) return;
      const data: Partial<Record<K, unknown>> = {};
      const failed: string[] = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") data[keys[i]] = result.value;
        else failed.push(labels[keys[i]]);
      });
      setState({ loading: false, data, failed });
    });
    return () => {
      active = false;
    };
  }, [sources, labels]);
  return state;
}

/**
 * Keeps the sources whose module the user has, so a cross-module dashboard doesn't call (and report as
 * failed) services the user can't use. Memoize the result: useDashboardSources reloads when it changes.
 */
export const sourcesForModules = <K extends string>(
  sources: Record<K, () => Promise<unknown>>,
  modules: Record<K, string>,
  allowed: (module: string) => boolean,
) => Object.fromEntries(Object.entries(sources).filter(([key]) => allowed(modules[key as K]))) as Record<K, () => Promise<unknown>>;

/* ================= dates and numbers ================= */

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-06-05" or "2026-06-05T10:00:00" as a local date (a bare date must not shift by the UTC offset). */
export const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(value));
  if (m && String(value).length === 10) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const monthKeyOf = (value?: string | null) => {
  const d = parseDate(value);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : "";
};

/** The last `count` months, oldest first, as { key: "2026-06", label: "Jun" }. */
export const monthsBack = (count: number) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleString(undefined, { month: "short" }) };
  });
};

/** Monday of the week containing `d`. */
export const weekStart = (d: Date) => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

/** The last `count` weeks (Monday starts), oldest first. */
export const weeksBack = (count: number) => {
  const current = weekStart(new Date());
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(current);
    start.setDate(start.getDate() - 7 * (count - 1 - i));
    return { key: isoDate(start), label: start.toLocaleDateString(dateLocale(), { day: "2-digit", month: "short" }) };
  });
};

export const formatDate = (value?: string | null) => companyDate(value);

export const formatNumber = (value: number) => companyNumber(value);

// Dashboards show whole amounts (or 1.2K style when compact), in the company's currency by default
export const formatMoney = (value: number, currency?: string | null, compact = false) =>
  companyMoney(value, { currency, whole: true, compact });

/** "IN_PROGRESS" → "In progress". */
export const titleCase = (code?: string | null) =>
  code ? code.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";

export const sum = <T,>(items: T[], value: (item: T) => unknown) =>
  items.reduce((total, item) => total + (Number(value(item)) || 0), 0);

/** Most common value (e.g. the currency most orders use). */
export const mostCommon = (values: (string | null | undefined)[], fallback: string) => {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((v) => counts.set(v as string, (counts.get(v as string) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
};

/* ================= components ================= */

/*
 * One card style for every dashboard (the app's cyan theme): white cards with a thin cyan-grey border and a
 * soft shadow, sitting on the pale cyan page. Colour carries meaning only: the cyan accent for navigation and
 * neutral figures, red / amber / green for bad / warning / good.
 */
// Cards are soft light green (#F1F8E9) with a light-green edge and a deeper two-layer shadow, raised from the
// pale cyan page (same as tables and stat cards, see Table.tsx and Statscard.css)
export const DASH_CARD =
  "rounded-xl border border-[#dcedc8] bg-[#f1f8e9] shadow-[0_2px_4px_rgba(15,23,42,0.06),0_10px_24px_rgba(15,23,42,0.08)] dark:border-gray-800 dark:bg-gray-900";
/** Hover for clickable cards: lift, cyan edge, deeper shadow. */
export const DASH_CARD_HOVER =
  "transition-all duration-200 hover:-translate-y-0.5 hover:border-[#4dd0e1] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_12px_24px_rgba(15,23,42,0.10)]";
/** Card heading and its small subtitle. */
export const DASH_TITLE = "text-sm font-semibold text-slate-800 dark:text-white";
export const DASH_SUBTITLE = "text-xs text-slate-500 dark:text-gray-400";

export type Tone = "blue" | "emerald" | "orange" | "purple" | "pink" | "indigo" | "red" | "teal" | "amber" | "cyan";

/*
 * Module summary cards (tiles, KPI and report cards) all follow the queue cards on the Manager Leave
 * Dashboard: a soft tinted card with a matching border, a tinted icon chip, a solid count pill and a
 * coloured "Open …" link, one tone per card. Full class names: Tailwind only generates what it sees.
 */
export const TONE_STYLES: Record<Tone, { card: string; icon: string; badge: string; link: string }> = {
  emerald: { card: "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200/80", icon: "bg-emerald-100 text-emerald-700", badge: "bg-emerald-600", link: "text-emerald-700" },
  amber: { card: "bg-amber-50/50 hover:bg-amber-50 border-amber-200/80", icon: "bg-amber-100 text-amber-700", badge: "bg-amber-500", link: "text-amber-700" },
  orange: { card: "bg-orange-50/50 hover:bg-orange-50 border-orange-200/80", icon: "bg-orange-100 text-orange-700", badge: "bg-orange-500", link: "text-orange-700" },
  cyan: { card: "bg-cyan-50/50 hover:bg-cyan-50 border-cyan-200/80", icon: "bg-cyan-100 text-cyan-700", badge: "bg-cyan-600", link: "text-cyan-700" },
  teal: { card: "bg-teal-50/50 hover:bg-teal-50 border-teal-200/80", icon: "bg-teal-100 text-teal-700", badge: "bg-teal-600", link: "text-teal-700" },
  blue: { card: "bg-sky-50/50 hover:bg-sky-50 border-sky-200/80", icon: "bg-sky-100 text-sky-700", badge: "bg-sky-600", link: "text-sky-700" },
  indigo: { card: "bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200/80", icon: "bg-indigo-100 text-indigo-700", badge: "bg-indigo-500", link: "text-indigo-700" },
  purple: { card: "bg-violet-50/50 hover:bg-violet-50 border-violet-200/80", icon: "bg-violet-100 text-violet-700", badge: "bg-violet-500", link: "text-violet-700" },
  pink: { card: "bg-pink-50/50 hover:bg-pink-50 border-pink-200/80", icon: "bg-pink-100 text-pink-700", badge: "bg-pink-500", link: "text-pink-700" },
  red: { card: "bg-rose-50/50 hover:bg-rose-50 border-rose-200/80", icon: "bg-rose-100 text-rose-700", badge: "bg-rose-500", link: "text-rose-700" },
};

/** The tinted card shell for a tone (add padding and layout). */
export const toneCard = (tone: Tone) =>
  `rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_14px_rgba(15,23,42,0.08)] transition-all hover:shadow-[0_2px_4px_rgba(15,23,42,0.07),0_12px_24px_rgba(15,23,42,0.10)] ${TONE_STYLES[tone].card} dark:border-transparent dark:bg-[#222222] dark:hover:bg-[#262626]`;
/** Icon chip, solid pill and link colours for a tone. */
export const toneIcon = (tone: Tone) => `${TONE_STYLES[tone].icon} dark:bg-[#191919] dark:text-gray-300`;
export const tonePill = (tone: Tone) => `${TONE_STYLES[tone].badge} text-white shadow-2xs dark:bg-transparent dark:text-gray-300`;
export const toneLink = (tone: Tone) => `${TONE_STYLES[tone].link} dark:text-gray-300`;

/** Tones in turn, for cards that have no meaning-based colour. */
export const TONE_CYCLE: Tone[] = ["emerald", "amber", "cyan", "indigo", "pink", "teal", "purple", "orange"];

/** Bar colours for charts, in order: the theme's cyans first, then distinct colours for further series. */
export const CHART_COLORS = ["#0097a7", "#4dd0e1", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

export const CHART_TOOLTIP = {
  backgroundColor: "white",
  border: "1px solid #d9eef2",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 6px 16px rgba(0, 151, 167, 0.12)",
};

export interface DashboardTile {
  name: string;
  route: string;
  icon: LucideIcon;
  tone: Tone;
  count?: number | null;
}

export function ModuleTiles({ tiles, loading }: { tiles: DashboardTile[]; loading: boolean }) {
  const navigate = useNavigate();
  return (
    // mb-5, not mb-6: index.css squeezes .mb-6 to 3px inside .app-content-tight
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <button
            key={tile.name}
            type="button"
            onClick={() => navigate(tile.route)}
            className={`group flex flex-col items-center p-3.5 hover:-translate-y-0.5 ${toneCard(tile.tone)}`}
          >
            <div className={`rounded-lg p-2 ${toneIcon(tile.tone)}`}>
              <Icon className="h-5 w-5" />
            </div>
            <h4 className="mt-2 text-center text-xs font-bold text-gray-900 dark:text-white">
              {t(tile.name)}
            </h4>
            {tile.count !== undefined && (
              <span className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tonePill(tile.tone)}`}>
                {loading ? "…" : tile.count === null ? "—" : formatNumber(tile.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function KpiCard({ label, value, hint, icon: Icon, tone, loading }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone: Tone;
  loading: boolean;
}) {
  return (
    <div className={`flex flex-col justify-between space-y-2 p-3.5 ${toneCard(tone)}`}>
      <div className="flex items-center gap-2">
        <div className={`flex-none rounded-lg p-1.5 ${toneIcon(tone)}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-bold text-gray-900 dark:text-white">{typeof label === "string" ? t(label) : label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{loading ? "…" : value}</p>
      {hint && !loading && <p className="text-[11px] text-gray-600 dark:text-gray-400">{typeof hint === "string" ? t(hint) : hint}</p>}
    </div>
  );
}

// iconClass is accepted for older callers but ignored: panel icons all use the theme accent
export function Panel({ title, subtitle, icon: Icon, children, bodyClass = "p-5" }: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClass?: string;
  children: ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className={`overflow-hidden ${DASH_CARD}`}>
      <div className="flex items-center justify-between border-b border-[#dcedc8] px-5 py-3.5 dark:border-gray-800">
        <div>
          <h3 className={DASH_TITLE}>{typeof title === "string" ? t(title) : title}</h3>
          {subtitle && <p className={`mt-0.5 ${DASH_SUBTITLE}`}>{typeof subtitle === "string" ? t(subtitle) : subtitle}</p>}
        </div>
        {Icon && <Icon className="h-[18px] w-[18px] text-[#0097a7] dark:text-cyan-300" />}
      </div>
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** Placeholder inside a chart or list while loading, or when there is nothing to show. */
export function EmptyState({ loading, children, height = 250 }: { loading: boolean; children: ReactNode; height?: number }) {
  return (
    <div className="flex items-center justify-center text-center text-sm text-gray-500" style={{ height }}>
      {loading ? "Loading…" : children}
    </div>
  );
}

export function LoadNotice({ failed }: { failed: string[] }) {
  if (!failed.length) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Some figures could not be loaded ({failed.join(", ")}), usually because you don't have access to that
      area. They are shown as —.
    </div>
  );
}

// One line per cell: the tables scroll sideways on narrow screens instead of wrapping dates into stacks
export const TABLE_HEAD = "whitespace-nowrap bg-[#f4fcfd] px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:bg-transparent";
export const TABLE_CELL = "whitespace-nowrap px-5 py-3 text-sm text-slate-600 dark:text-gray-300";
