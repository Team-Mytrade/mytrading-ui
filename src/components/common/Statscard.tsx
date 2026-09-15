import React from "react";
import {
  ArrowPathIcon,
  ChartBarIcon,
  FunnelIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import "./Statscard.css";

interface StatsCardProps {
  label: string;
  value: string | number;
  gradient?: string;
  borderColor?: string;
  labelColor?: string;
  icon?: React.ReactNode;
  collapsed?: boolean;
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
}) => {
  const tone = getTone(`${_gradient} ${_borderColor} ${_labelColor}`);

  return (
    <div className={`stats-card stats-card--${tone}`}>
      <div
        className={`stats-card__content ${collapsed ? "stats-card__content--collapsed" : ""}`}
      >
        <div className="stats-card__metric">
          <span className="stats-card__icon" aria-hidden="true">
            {icon || <ChartBarIcon />}
          </span>
          <p className="stats-card__label">{label}</p>
          <p className="stats-card__value">{value}</p>
        </div>
      </div>
      <StatsCardActions />
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
  const [showQuickSearch, setShowQuickSearch] = React.useState(false);
  const [quickSearch, setQuickSearch] = React.useState("");
  const toggleColumns = () => {
    const anchor = [...document.querySelectorAll<HTMLElement>("[data-table-tool='columns']")]
      .find((button) => button.offsetParent !== null);
    const rect = anchor?.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent("reusable-table:toggle-columns", { detail: rect ? { left: rect.left, bottom: rect.bottom } : undefined }));
  };
  const toggleColumnFilters = () => window.dispatchEvent(new Event("reusable-table:toggle-column-filters"));
  const toggleQuickSearch = () => {
    setShowQuickSearch((current) => {
      if (current) {
        setQuickSearch("");
        window.dispatchEvent(new CustomEvent("reusable-table:quick-search", { detail: "" }));
      }
      return !current;
    });
  };
  const handleQuickSearch = (value: string) => {
    setQuickSearch(value);
    window.dispatchEvent(new CustomEvent("reusable-table:quick-search", { detail: value }));
  };
  const actions = [
    { label: "Choose columns", icon: ListBulletIcon, onClick: onListView ?? toggleColumns },
    { label: "Share", icon: ShareIcon, onClick: onShare },
    { label: "Search", icon: MagnifyingGlassIcon, onClick: onSearch ?? toggleQuickSearch },
    { label: "Filter", icon: FunnelIcon, onClick: onFilter ?? toggleColumnFilters },
    { label: "Refresh", icon: ArrowPathIcon, onClick: onRefresh },
  ];

  return (
    <div className="stats-card-actions" aria-label="List tools">
      {actions.map(({ label, icon: Icon, onClick }) => (
        <React.Fragment key={label}>
          {label === "Search" && showQuickSearch && (
            <input className="stats-card-actions__search" type="search" value={quickSearch} onChange={(event) => handleQuickSearch(event.target.value)} placeholder="Search table..." aria-label="Search table" autoFocus />
          )}
          {label === "Filter" && filterControl ? filterControl : (
            <button type="button" className="stats-card-actions__button" data-table-tool={label === "Choose columns" ? "columns" : undefined} onClick={onClick} title={label} aria-label={label}>
              <Icon />
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};


