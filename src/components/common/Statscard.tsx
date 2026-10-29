import React, { useEffect, useRef, useState } from "react";
import {
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import "../../styles/Statscard.css";
import { t } from "../../i18n/i18n";
import TableToolbar from "./TableToolbar";

interface StatsCardProps {
  label: string;
  value: string | number;
  gradient?: string;
  borderColor?: string;
  labelColor?: string;
  icon?: React.ReactNode;
  collapsed?: boolean;
  /** Keeps the card layout fixed while its metric content displays a loading skeleton. */
  loading?: boolean;
  /** Optional handlers for the shared list toolbar rendered beside the last card in a stats grid. */
  onListView?: () => void;
  onShare?: () => void;
  onSearch?: () => void;
  onFilter?: () => void;
  onRefresh?: () => void;
  filterControl?: React.ReactNode;
  /** Makes the card clickable (e.g. to filter the table to these records). */
  onClick?: () => void;
  /** Shows the card as the active filter. */
  selected?: boolean;
  /** Tooltip for a clickable card. */
  title?: string;
}

interface StatsCardActionsProps {
  onListView?: () => void;
  onShare?: () => void;
  onSearch?: () => void;
  onFilter?: () => void;
  onRefresh?: () => void;
  filterControl?: React.ReactNode;
}

const getTone = (classes: string) => {
  const value = classes.toLowerCase();
  if (value.includes("green") || value.includes("emerald")) return "success";
  if (value.includes("yellow") || value.includes("amber") || value.includes("orange")) return "warning";
  if (value.includes("red") || value.includes("rose") || value.includes("pink")) return "danger";
  if (value.includes("purple") || value.includes("indigo")) return "purple";
  if (value.includes("cyan") || value.includes("blue")) return "info";
  return "neutral";
};

const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  gradient: _gradient = "from-gray-50 to-gray-100",
  borderColor: _borderColor = "border-gray-200",
  labelColor: _labelColor = "text-gray-600",
  icon,
  collapsed = false,
  loading = false,
  onListView,
  onShare,
  onSearch,
  onFilter,
  onRefresh,
  filterControl,
  onClick,
  selected = false,
  title,
}) => {
  const tone = getTone(`${_gradient} ${_borderColor} ${_labelColor}`);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const showRefreshSkeleton = () => {
      setIsRefreshing(true);
      if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = window.setTimeout(() => setIsRefreshing(false), 600);
    };
    window.addEventListener("reusable-table:refresh", showRefreshSkeleton);
    return () => {
      window.removeEventListener("reusable-table:refresh", showRefreshSkeleton);
      if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  return (
    <div className={`stats-card stats-card--${tone}`}>
      {/* Only the metric area is clickable, so the toolbar buttons beside it keep working. */}
      <div
        className={`stats-card__content ${collapsed ? "stats-card__content--collapsed" : ""} ${
          onClick ? "cursor-pointer rounded-lg transition hover:opacity-80" : ""
        } ${selected ? "rounded-lg ring-1 ring-current" : ""}`}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-pressed={onClick ? selected : undefined}
        title={title}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onClick && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        {loading || isRefreshing ? (
          <div className="stats-card__metric stats-card__metric--skeleton" aria-label={`Refreshing ${label}`}>
            <span className="stats-card__skeleton stats-card__skeleton--icon" />
            <span className="stats-card__skeleton stats-card__skeleton--label" />
            <span className="stats-card__skeleton stats-card__skeleton--value" />
          </div>
        ) : (
          <div className="stats-card__metric">
            <span className="stats-card__icon" aria-hidden="true">
              {icon || <ChartBarIcon />}
            </span>
            <p className="stats-card__label">{t(label)}</p>
            <p className="stats-card__value">{value}</p>
          </div>
        )}
      </div>
      <StatsCardActions
        onListView={onListView}
        onShare={onShare}
        onSearch={onSearch}
        onFilter={onFilter}
        onRefresh={onRefresh}
        filterControl={filterControl}
      />
    </div>
  );
};

export default StatsCard;

/** Compact actions displayed at the end of a reusable stats-card row. */
export const StatsCardActions: React.FC<StatsCardActionsProps> = ({
  onListView,
  onShare,
  onSearch,
  onFilter,
  onRefresh,
  filterControl,
}) => {
  return (
    <TableToolbar
      onListView={onListView}
      onShare={onShare}
      onSearch={onSearch}
      onFilter={onFilter}
      onRefresh={onRefresh}
      filterControl={filterControl}
    />
  );
};


