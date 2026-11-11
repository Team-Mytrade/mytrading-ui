// Shared pieces of the module dashboards (Procurement, Delivery, HRMS, Attendance). Every figure on
import { t } from "../../i18n/i18n";
// those dashboards comes from the module's own API; nothing here holds sample data.
import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Inbox, type LucideIcon } from "lucide-react";
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
  "rounded-xl border border-[#dcedc8] bg-[#f1f8e9] shadow-[0_2px_4px_rgba(15,23,42,0.06),0_10px_24px_rgba(15,23,42,0.08)] dark:border-[#363636] dark:bg-[#272727] dark:shadow-[0_1px_2px_rgba(0,0,0,0.45),0_8px_20px_rgba(0,0,0,0.25)]";
/** Hover for clickable cards: lift, cyan edge, deeper shadow. */
export const DASH_CARD_HOVER =
  "transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgb(var(--brand-300,77_208_225))] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_12px_24px_rgba(15,23,42,0.10)]";
/** Card heading and its small subtitle. */
export const DASH_TITLE = "text-sm font-semibold text-slate-800 dark:text-gray-50";
export const DASH_SUBTITLE = "text-xs text-slate-500 dark:text-[#a3a3a3]";

export type Tone = "blue" | "emerald" | "orange" | "purple" | "pink" | "indigo" | "red" | "teal" | "amber" | "cyan";

/*
 * Module summary cards (tiles, KPI and report cards) all follow the queue cards on the Manager Leave
 * Dashboard: a soft tinted card with a matching border, a tinted icon chip, a solid count pill and a
 * coloured "Open …" link, one tone per card. Full class names: Tailwind only generates what it sees.
 */
export const TONE_STYLES: Record<Tone, { card: string; icon: string; badge: string; link: string; dark: string }> = {
  emerald: { card: "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200/80", icon: "bg-emerald-100 text-emerald-700", badge: "bg-emerald-600", link: "text-emerald-700", dark: "dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-1 dark:ring-emerald-400/20" },
  amber: { card: "bg-amber-50/50 hover:bg-amber-50 border-amber-200/80", icon: "bg-amber-100 text-amber-700", badge: "bg-amber-500", link: "text-amber-700", dark: "dark:bg-amber-400/15 dark:text-amber-300 dark:ring-1 dark:ring-amber-400/20" },
  orange: { card: "bg-orange-50/50 hover:bg-orange-50 border-orange-200/80", icon: "bg-orange-100 text-orange-700", badge: "bg-orange-500", link: "text-orange-700", dark: "dark:bg-orange-400/15 dark:text-orange-300 dark:ring-1 dark:ring-orange-400/20" },
  cyan: { card: "bg-cyan-50/50 hover:bg-cyan-50 border-cyan-200/80", icon: "bg-cyan-100 text-cyan-700", badge: "bg-cyan-600", link: "text-cyan-700", dark: "dark:bg-cyan-400/15 dark:text-cyan-300 dark:ring-1 dark:ring-cyan-400/20" },
  teal: { card: "bg-teal-50/50 hover:bg-teal-50 border-teal-200/80", icon: "bg-teal-100 text-teal-700", badge: "bg-teal-600", link: "text-teal-700", dark: "dark:bg-teal-400/15 dark:text-teal-300 dark:ring-1 dark:ring-teal-400/20" },
  blue: { card: "bg-sky-50/50 hover:bg-sky-50 border-sky-200/80", icon: "bg-sky-100 text-sky-700", badge: "bg-sky-600", link: "text-sky-700", dark: "dark:bg-sky-400/15 dark:text-sky-300 dark:ring-1 dark:ring-sky-400/20" },
  indigo: { card: "bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200/80", icon: "bg-indigo-100 text-indigo-700", badge: "bg-indigo-500", link: "text-indigo-700", dark: "dark:bg-indigo-400/15 dark:text-indigo-300 dark:ring-1 dark:ring-indigo-400/20" },
  purple: { card: "bg-violet-50/50 hover:bg-violet-50 border-violet-200/80", icon: "bg-violet-100 text-violet-700", badge: "bg-violet-500", link: "text-violet-700", dark: "dark:bg-violet-400/15 dark:text-violet-300 dark:ring-1 dark:ring-violet-400/20" },
  pink: { card: "bg-pink-50/50 hover:bg-pink-50 border-pink-200/80", icon: "bg-pink-100 text-pink-700", badge: "bg-pink-500", link: "text-pink-700", dark: "dark:bg-pink-400/15 dark:text-pink-300 dark:ring-1 dark:ring-pink-400/20" },
  red: { card: "bg-rose-50/50 hover:bg-rose-50 border-rose-200/80", icon: "bg-rose-100 text-rose-700", badge: "bg-rose-500", link: "text-rose-700", dark: "dark:bg-rose-400/15 dark:text-rose-300 dark:ring-1 dark:ring-rose-400/20" },
};

/** The tinted card shell for a tone (add padding and layout). */
export const toneCard = (tone: Tone) =>
  `rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_14px_rgba(15,23,42,0.08)] transition-all hover:shadow-[0_2px_4px_rgba(15,23,42,0.07),0_12px_24px_rgba(15,23,42,0.10)] ${TONE_STYLES[tone].card} dark:border-[#363636] dark:bg-[#272727] dark:hover:bg-[#2e2e2e]`;
/** Icon chip, solid pill and link colours for a tone. */
export const toneIcon = (tone: Tone) => `${TONE_STYLES[tone].icon} ${TONE_STYLES[tone].dark}`;
export const tonePill = (tone: Tone) => `${TONE_STYLES[tone].badge} text-white shadow-2xs`;
export const toneLink = (tone: Tone) => `${TONE_STYLES[tone].link} dark:text-gray-200`;

/** Tones in turn, for cards that have no meaning-based colour. */
export const TONE_CYCLE: Tone[] = ["emerald", "amber", "cyan", "indigo", "pink", "teal", "purple", "orange"];

/** Bar colours for charts, in order: the theme's cyans first, then distinct colours for further series. */
export const CHART_COLORS = ["#0097a7", "#4dd0e1", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

export const CHART_TOOLTIP = {
  backgroundColor: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  fontSize: "12px",
  padding: "8px 10px",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
};

/*
 * One chart style for every dashboard: faint dashed grid, no axis or tick lines, small slate labels, round legend
 * markers and a soft hover band. Spread them onto the Recharts parts: <CartesianGrid {...CHART_GRID} />,
 * <XAxis {...CHART_AXIS} … />, <Legend {...CHART_LEGEND} />, <Tooltip {...CHART_HOVER} … />.
 */
export const CHART_GRID = { strokeDasharray: "4 4", stroke: "#e2e8f0", vertical: false } as const;
/** Grid for horizontal bar charts (layout="vertical"): vertical lines only. */
export const CHART_GRID_V = { strokeDasharray: "4 4", stroke: "#e2e8f0", horizontal: false } as const;
export const CHART_AXIS = { stroke: "#94a3b8", fontSize: 11, tickLine: false, axisLine: false, tickMargin: 6 } as const;
export const CHART_LEGEND = { iconType: "circle" as const, iconSize: 8, wrapperStyle: { fontSize: 12, paddingTop: 4 } };
export const CHART_HOVER = { contentStyle: CHART_TOOLTIP, cursor: { fill: "rgba(148, 163, 184, 0.12)" } };

export interface DashboardTile {
  name: string;
  route: string;
  icon: LucideIcon;
  tone: Tone;
  count?: number | null;
}

/*
 * The dashboard standard (every Command Center dashboard):
 *   1. Quick links: one slim row of chips (icon, name, count), scrolling sideways when there are many.
 *   2. Figures: compact KPI cards, four across (two on a phone).
 *   3. Panels: charts and short lists in a grid that fills the rest of the screen; a chart takes its card's height
 *      (ChartBox) and a list scrolls inside its card, so on a laptop or desktop the page never scrolls (Home.css).
 * Build it with DashboardLayout; the pieces below are sized for it.
 */
export function ModuleTiles({ tiles, loading }: { tiles: DashboardTile[]; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <nav className="flex flex-none flex-wrap gap-2" aria-label={t("Quick links")}>
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <button
            key={tile.name}
            type="button"
            onClick={() => navigate(tile.route)}
            className="group inline-flex flex-none items-center gap-2 rounded-full border border-slate-200 bg-white/90 py-1 pe-2 ps-1 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-px hover:border-[rgb(var(--brand-300,77_208_225))] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:border-[#3a3a3a] dark:bg-[#272727] dark:shadow-none dark:hover:border-cyan-500/60 dark:hover:bg-[#2e2e2e]"
          >
            <span className={`grid h-6 w-6 place-items-center rounded-full ${toneIcon(tile.tone)}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="whitespace-nowrap text-xs font-semibold text-slate-700 group-hover:text-slate-900 dark:text-gray-200 dark:group-hover:text-white">{t(tile.name)}</span>
            {tile.count !== undefined && (
              <span className="inline-flex min-w-[1.4rem] justify-center rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-bold text-slate-700 dark:bg-[#3a3a3a] dark:text-gray-100">
                {loading ? "…" : tile.count === null ? "—" : formatNumber(tile.count)}
              </span>
            )}
          </button>
        );
      })}
    </nav>
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
    <div className={`relative flex min-w-0 items-start gap-3 overflow-hidden px-4 py-3 ${DASH_CARD}`}>
      {/* thin accent along the top edge: the card's one touch of colour besides its icon */}
      <span className={`absolute inset-x-0 top-0 h-[3px] ${TONE_STYLES[tone].badge} opacity-80 dark:opacity-100`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#b0b0b0]">
          {typeof label === "string" ? t(label) : label}
        </p>
        <p className="mt-1 truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900 tabular-nums dark:text-white">
          {loading ? <span className="inline-block h-6 w-20 animate-pulse rounded bg-slate-200/80 align-middle dark:bg-[#3a3a3a]" /> : value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-[#a3a3a3]">
          {hint && !loading ? (typeof hint === "string" ? t(hint) : hint) : " "}
        </p>
      </div>
      <div className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${toneIcon(tone)}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
    </div>
  );
}

// iconClass is accepted for older callers but ignored: panel icons all use the theme accent
export function Panel({ title, subtitle, icon: Icon, children, bodyClass = "p-4", className = "" }: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClass?: string;
  children: ReactNode;
  bodyClass?: string;
  /** Grid placement, e.g. "lg:col-span-2" for a wide panel. */
  className?: string;
}) {
  return (
    <section className={`overflow-hidden ${DASH_CARD} ${className}`}>
      <div className="flex flex-none items-center gap-2.5 border-b border-[#dcedc8]/80 px-4 py-2.5 dark:border-[#363636]">
        {Icon && (
          <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[rgb(var(--brand-50,224_247_250))] text-[rgb(var(--brand-600,0_151_167))] ring-1 ring-[rgb(var(--brand-100,217_238_242))] dark:bg-cyan-400/15 dark:text-cyan-300 dark:ring-cyan-400/25">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className={`truncate ${DASH_TITLE}`}>{typeof title === "string" ? t(title) : title}</h3>
          {subtitle && <p className={`truncate text-[11px] ${DASH_SUBTITLE.replace("text-xs ", "")}`}>{typeof subtitle === "string" ? t(subtitle) : subtitle}</p>}
        </div>
      </div>
      <div className={`dash-panel-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** Where a chart goes: 240px tall on its own, its card's full height in a DashboardLayout on a large screen. */
export function ChartBox({ children }: { children: ReactNode }) {
  return <div className="dash-chart h-[240px] w-full">{children}</div>;
}

/** Placeholder inside a chart or list while loading, or when there is nothing to show. */
export function EmptyState({ loading, children, height = 240 }: { loading: boolean; children: ReactNode; height?: number }) {
  return (
    <div className="dash-empty flex flex-col items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-[#a3a3a3]" style={{ height }}>
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[rgb(var(--brand-500,0_172_193))] dark:border-[#404040] dark:border-t-cyan-400" aria-label={t("Loading…")} />
      ) : (
        <>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-slate-400 ring-1 ring-slate-200 dark:bg-[#323232] dark:text-[#a3a3a3] dark:ring-[#404040]">
            <Inbox className="h-4 w-4" />
          </span>
          <span>{children}</span>
        </>
      )}
    </div>
  );
}

export function LoadNotice({ failed }: { failed: string[] }) {
  if (!failed.length) return null;
  return (
    <div className="flex-none rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
      Some figures could not be loaded ({failed.join(", ")}), usually because you don't have access to that
      area. They are shown as —.
    </div>
  );
}

/**
 * The standard dashboard page: load notice, quick links, figures, then the panels. panelClass sets the panel grid's
 * columns on a large screen (default two; "lg:grid-cols-3" for three).
 */
export function DashboardLayout({ failed = [], links, kpis, panelClass = "lg:grid-cols-2", children }: {
  failed?: string[];
  links?: ReactNode;
  kpis?: ReactNode;
  panelClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="dash-layout mx-auto flex w-full max-w-7xl flex-col gap-3 px-1 pb-2 pt-1">
      <LoadNotice failed={failed} />
      {links}
      {kpis && <div className="grid flex-none grid-cols-2 gap-3 lg:grid-cols-4">{kpis}</div>}
      <div className={`dash-body grid grid-cols-1 gap-3 ${panelClass}`}>{children}</div>
    </div>
  );
}

// One line per cell: the tables scroll sideways on narrow screens instead of wrapping dates into stacks; the head
// stays in view while a list scrolls inside its card
export const TABLE_HEAD = "sticky top-0 z-[1] whitespace-nowrap bg-[#f4fcfd] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:bg-[#2f2f2f] dark:text-[#b0b0b0]";
export const TABLE_CELL = "whitespace-nowrap px-4 py-2 text-sm text-slate-600 dark:text-[#d4d4d4]";
