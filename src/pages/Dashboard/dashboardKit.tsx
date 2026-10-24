// Shared pieces of the module dashboards (Procurement, Delivery, HRMS, Attendance). Every figure on
// those dashboards comes from the module's own API; nothing here holds sample data.
import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

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
    return { key: isoDate(start), label: start.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) };
  });
};

export const formatDate = (value?: string | null) =>
  parseDate(value)?.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) ?? "—";

export const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export const formatMoney = (value: number, currency = "INR", compact = false) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? "compact" : "standard",
    }).format(value);
  } catch {
    return formatNumber(Math.round(value)); // unknown currency code
  }
};

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

export type Tone = "blue" | "emerald" | "orange" | "purple" | "pink" | "indigo" | "red" | "teal" | "amber" | "cyan";

const tileTone: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  red: "bg-red-50 text-red-600 group-hover:bg-red-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
  cyan: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100",
};

const kpiTone: Record<Tone, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  pink: "bg-pink-100 text-pink-600",
  indigo: "bg-indigo-100 text-indigo-600",
  red: "bg-red-100 text-red-600",
  teal: "bg-teal-100 text-teal-600",
  amber: "bg-amber-100 text-amber-600",
  cyan: "bg-cyan-100 text-cyan-600",
};

/** Bar colours for charts, in order. */
export const CHART_COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6366f1"];

export const CHART_TOOLTIP = {
  backgroundColor: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  fontSize: "12px",
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
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <button
            key={tile.name}
            type="button"
            onClick={() => navigate(tile.route)}
            className="group flex flex-col items-center rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <div className={`rounded-lg p-2.5 transition-colors duration-200 ${tileTone[tile.tone]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <h4 className="mt-2 text-center text-xs font-semibold text-gray-900 transition-colors group-hover:text-cyan-600 dark:text-gray-100">
              {tile.name}
            </h4>
            {tile.count !== undefined && (
              <p className="mt-0.5 text-xs text-gray-500">{loading ? "…" : tile.count === null ? "—" : formatNumber(tile.count)}</p>
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
    <div className="rounded-xl border border-gray-100 bg-white p-5 transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className={`mb-3 inline-flex rounded-lg p-2.5 ${kpiTone[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "…" : value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
      {hint && !loading && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function Panel({ title, subtitle, icon: Icon, iconClass, children, bodyClass = "p-5" }: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClass?: string;
  children: ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {Icon && <Icon className={`h-5 w-5 ${iconClass ?? "text-gray-400"}`} />}
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
export const TABLE_HEAD = "whitespace-nowrap px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500";
export const TABLE_CELL = "whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300";
