import React, { useState } from "react";
import { t } from "../../i18n/i18n";
import { isDarkTheme, money } from "./taxTracker";

/** A department's slice: its name, its value, and its position in the company's (alphabetical) department list. */
export interface DonutSlice {
  name: string;
  value: number;
  /** Fixed per department so its colour never changes with the month, the filter or its rank. */
  colorIndex: number;
  note?: string;
}

// Validated categorical palette (8 hues, fixed order), stepped for light and dark surfaces
const LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const OTHER_LIGHT = "#9ca3af";
const OTHER_DARK = "#6b7280";
const MAX_SLICES = 7; // more than this folds into "Other"

const SIZE = 168;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 2; // px of surface between slices

/** Compact rupees: ₹16.8 L, ₹1.2 Cr. */
const short = (value: number) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return money(n);
};

/** Part of a whole as a donut with the total in the middle and a legend (share and amount); hover a slice or a row. */
const DepartmentDonut: React.FC<{ slices: DonutSlice[]; totalLabel?: string; onSelect?: (name: string) => void }> = ({ slices, totalLabel, onSelect }) => {
  const [active, setActive] = useState<string | null>(null);
  const dark = isDarkTheme();
  const palette = dark ? DARK : LIGHT;

  // The biggest departments get their own slice (the rest fold into "Other"); slices are drawn in palette order so
  // neighbouring colours are the pairs the palette was checked for (largest-first would put e.g. orange beside yellow)
  const byValue = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const keep = byValue.length > MAX_SLICES ? byValue.slice(0, MAX_SLICES - 1) : byValue;
  const rest = byValue.slice(keep.length);
  const shown = [...keep].sort((a, b) => a.colorIndex - b.colorIndex);
  const parts = [
    ...shown.map((s) => ({ ...s, color: palette[s.colorIndex % palette.length] })),
    ...(rest.length ? [{ name: t("Other"), value: rest.reduce((a, s) => a + s.value, 0), colorIndex: -1,
      note: `${rest.length} ${t("departments")}`, color: dark ? OTHER_DARK : OTHER_LIGHT }] : []),
  ];
  const total = parts.reduce((a, p) => a + p.value, 0);
  const focus = parts.find((p) => p.name === active);

  let offset = 0;
  const arcs = parts.map((p) => {
    const length = total > 0 ? (p.value / total) * C : 0;
    const visible = parts.length > 1 ? Math.max(0, length - GAP) : length;
    const arc = { ...p, dash: `${visible} ${C - visible}`, offset: -offset, share: total > 0 ? (p.value / total) * 100 : 0 };
    offset += length;
    return arc;
  });

  return (
    // Donut and legend sit together in the middle; the legend is kept to a readable width so its amounts stay
    // close to the names instead of drifting to the far edge on wide screens
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 items-center justify-center gap-6 sm:grid-cols-[auto_minmax(0,26rem)] sm:gap-10">
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
          aria-label={arcs.map((a) => `${a.name} ${Math.round(a.share)}%`).join(", ")}>
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} fill="none">
            {arcs.map((a) => (
              <circle key={a.name} cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={a.color}
                strokeWidth={active === a.name ? STROKE + 4 : STROKE} strokeDasharray={a.dash} strokeDashoffset={a.offset}
                opacity={active && active !== a.name ? 0.35 : 1}
                style={{ transition: "opacity 120ms, stroke-width 120ms", cursor: "pointer" }}
                onMouseEnter={() => setActive(a.name)} onMouseLeave={() => setActive(null)}
                onClick={() => a.colorIndex >= 0 && onSelect?.(a.name)}>
                <title>{`${a.name}: ${money(a.value)} (${a.share.toFixed(1)}%)`}</title>
              </circle>
            ))}
          </g>
        </svg>
        {/* The centre: the total, or the slice being hovered */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[96px] truncate text-[11px] text-slate-500 dark:text-gray-400">{focus ? focus.name : totalLabel ?? t("Total")}</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{short(focus ? focus.value : total)}</span>
          {focus && <span className="text-[11px] text-slate-500 dark:text-gray-400">{((focus.value / (total || 1)) * 100).toFixed(1)}%</span>}
        </div>
      </div>

      <ul className="grid grid-cols-[12px_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 text-sm">
        {arcs.map((a) => (
          <li key={a.name} className="contents" onMouseEnter={() => setActive(a.name)} onMouseLeave={() => setActive(null)}>
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: a.color }} aria-hidden="true" />
            {onSelect && a.colorIndex >= 0 ? (
              <button type="button" onClick={() => onSelect(a.name)} title={`${t("Show")} ${a.name}`}
                className={`truncate text-left hover:text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${active === a.name ? "font-semibold text-slate-900 dark:text-white" : "text-slate-700 dark:text-gray-200"}`}>
                {a.name}
              </button>
            ) : (
              <span className={`truncate ${active === a.name ? "font-semibold text-slate-900 dark:text-white" : "text-slate-700 dark:text-gray-200"}`} title={a.name}>
                {a.name}{a.note && <span className="ml-1 text-[11px] text-slate-400">({a.note})</span>}
              </span>
            )}
            <span className="text-right text-slate-500 tabular-nums dark:text-gray-400">{Math.round(a.share)}%</span>
            <span className="text-right text-slate-900 tabular-nums dark:text-white">{short(a.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DepartmentDonut;
