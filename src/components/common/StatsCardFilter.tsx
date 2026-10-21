import { useMemo, useState } from "react";
import StatsCard from "./Statscard";

/**
 * Reusable "click a stats card to filter the table" feature.
 *
 * Usage in any page:
 *
 *   const cards: StatsCardOption<Order>[] = [
 *     { key: "ALL", label: "All Orders", match: () => true },
 *     { key: "OPEN", label: "Open", match: (row) => row.status === "OPEN", tone: "blue" },
 *   ];
 *   const { filteredRows, cardFilterProps } = useStatsCardFilter(rows, cards);
 *
 *   <StatsCardFilter {...cardFilterProps} />
 *   <ReusableTable data={filteredRows} ... />
 */

export type StatsCardTone = "cyan" | "green" | "red" | "amber" | "blue" | "slate";

export type StatsCardOption<T> = {
  /** Unique key. Use "ALL" for the card that shows everything. */
  key: string;
  label: string;
  /** Which rows this card counts and shows when clicked. */
  match: (row: T) => boolean;
  tone?: StatsCardTone;
};

const TONES: Record<StatsCardTone, { gradient: string; border: string; label: string }> = {
  cyan: { gradient: "from-cyan-50 to-blue-50", border: "border-cyan-100", label: "text-cyan-600" },
  green: { gradient: "from-green-50 to-emerald-50", border: "border-green-100", label: "text-green-600" },
  red: { gradient: "from-rose-50 to-red-50", border: "border-rose-100", label: "text-rose-600" },
  amber: { gradient: "from-amber-50 to-yellow-50", border: "border-amber-100", label: "text-amber-600" },
  blue: { gradient: "from-blue-50 to-indigo-50", border: "border-blue-100", label: "text-blue-600" },
  slate: { gradient: "from-slate-50 to-gray-50", border: "border-slate-200", label: "text-slate-600" },
};

/* ------------------------------------------------------------------ */
/* Ready-made card sets                                                */
/* ------------------------------------------------------------------ */

/** Total / Active / Inactive, for records with an `active` true/false flag. */
export function activeStatusCards<T extends { active?: unknown }>(totalLabel = "Total Records"): StatsCardOption<T>[] {
  return [
    { key: "ALL", label: totalLabel, match: () => true, tone: "cyan" },
    { key: "ACTIVE", label: "Active", match: (row) => row.active === true, tone: "green" },
    { key: "INACTIVE", label: "Inactive", match: (row) => row.active === false, tone: "red" },
  ];
}

const toneForStatus = (status: string): StatsCardTone => {
  if (["APPROVED", "RECEIVED", "COMPLETED", "ACTIVE", "ISSUED", "CLOSED"].includes(status)) return "green";
  if (["REJECTED", "CANCELLED", "INACTIVE", "FAILED"].includes(status)) return "red";
  if (["SUBMITTED", "PENDING", "IN_REVIEW", "PARTIALLY_RECEIVED", "SENT"].includes(status)) return "blue";
  if (status === "DRAFT") return "slate";
  return "amber";
};

const statusText = (status: string) =>
  status === "SUBMITTED" ? "Pending Approval" : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

/** Total + one card per status found in the rows (up to `max`), e.g. Draft / Approved / Rejected. */
export function statusFieldCards<T>(
  rows: T[],
  getStatus: (row: T) => unknown = (row) => (row as { status?: unknown }).status,
  totalLabel = "Total Records",
  max = 6
): StatsCardOption<T>[] {
  const read = (row: T) => String(getStatus(row) ?? "").toUpperCase();
  const statuses = [...new Set(rows.map(read).filter(Boolean))].slice(0, max);
  return [
    { key: "ALL", label: totalLabel, match: () => true, tone: "cyan" },
    ...statuses.map((status) => ({
      key: `STATUS:${status}`,
      label: statusText(status),
      match: (row: T) => read(row) === status,
      tone: toneForStatus(status),
    })),
  ];
}

/** Picks a sensible default: Active/Inactive if rows have `active`, else by `status`, else Total only. */
export function defaultStatsCards<T>(rows: T[]): StatsCardOption<T>[] {
  if (rows.some((row) => typeof (row as { active?: unknown }).active === "boolean")) {
    return activeStatusCards<T & { active?: unknown }>() as StatsCardOption<T>[];
  }
  return statusFieldCards(rows);
}

/* ------------------------------------------------------------------ */
/* Hook + component                                                    */
/* ------------------------------------------------------------------ */

/** Keeps track of the selected card and gives back the rows to show in the table. */
export function useStatsCardFilter<T>(rows: T[], cards: StatsCardOption<T>[]) {
  const [selected, setSelected] = useState("ALL");
  const selectedCard = cards.find((card) => card.key === selected);

  const filteredRows = useMemo(
    () => (selectedCard ? rows.filter(selectedCard.match) : rows),
    [rows, selectedCard]
  );

  return {
    selected,
    setSelected,
    filteredRows,
    /** Spread into <StatsCardFilter {...cardFilterProps} />. */
    cardFilterProps: { rows, cards, selected, onSelect: setSelected },
  };
}

type StatsCardFilterProps<T> = {
  rows: T[];
  cards: StatsCardOption<T>[];
  selected: string;
  onSelect: (key: string) => void;
  className?: string;
};

/**
 * The row of stats cards. Click a card to show only its rows; click it again to show all.
 * Keeps the original stats-card layout, so the toolbar icons (columns, export, search,
 * filter, refresh) stay in place.
 */
export default function StatsCardFilter<T>({
  rows,
  cards,
  selected,
  onSelect,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2",
}: StatsCardFilterProps<T>) {
  return (
    <div className={className}>
      {cards.map((card) => {
        const tone = TONES[card.tone || "cyan"];
        const isSelected = selected === card.key && card.key !== "ALL";
        return (
          <StatsCard
            key={card.key}
            label={card.label}
            value={rows.filter(card.match).length}
            gradient={tone.gradient}
            borderColor={tone.border}
            labelColor={tone.label}
            onClick={() => onSelect(selected === card.key ? "ALL" : card.key)}
            selected={isSelected}
            title={isSelected ? "Show all records" : `Show only: ${card.label}`}
          />
        );
      })}
    </div>
  );
}
