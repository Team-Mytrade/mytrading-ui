import React from "react";
import {
  ArrowPathIcon,
  FunnelIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import "./Statscard.css";

export interface TableToolbarProps {
  onListView?: () => void;
  onShare?: () => void;
  onSearch?: () => void;
  onFilter?: () => void;
  onRefresh?: () => void;
  filterControl?: React.ReactNode;
}

/** Standalone compact toolbar with the same 5 actions as StatsCardActions.
 *  Can be used independently of StatsCard anywhere in the app.
 */
const TableToolbar: React.FC<TableToolbarProps> = ({
  onListView,
  onShare,
  onSearch,
  onFilter,
  onRefresh,
  filterControl,
}) => {
  const [showQuickSearch, setShowQuickSearch] = React.useState(false);
  const [quickSearch, setQuickSearch] = React.useState("");
  const columnsButtonRef = React.useRef<HTMLButtonElement>(null);

  const toggleColumns = () => {
    // Use the ref directly so positioning always works regardless of offsetParent
    const rect = columnsButtonRef.current?.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent("reusable-table:toggle-columns", {
        detail: rect ? { left: rect.left, bottom: rect.bottom } : undefined,
      })
    );
  };

  const toggleColumnFilters = () =>
    window.dispatchEvent(new Event("reusable-table:toggle-column-filters"));

  const toggleQuickSearch = () => {
    setShowQuickSearch((current) => {
      if (current) {
        setQuickSearch("");
        window.dispatchEvent(
          new CustomEvent("reusable-table:quick-search", { detail: "" })
        );
      }
      return !current;
    });
  };

  const handleQuickSearch = (value: string) => {
    setQuickSearch(value);
    window.dispatchEvent(
      new CustomEvent("reusable-table:quick-search", { detail: value })
    );
  };

  return (
    <div className="stats-card-actions" aria-label="List tools">
      {/* 1. Choose Columns */}
      <button
        ref={columnsButtonRef}
        type="button"
        className="stats-card-actions__button"
        data-table-tool="columns"
        onClick={onListView ?? toggleColumns}
        title="Choose columns"
        aria-label="Choose columns"
      >
        <ListBulletIcon />
      </button>

      {/* 2. Share */}
      {onShare && (
        <button
          type="button"
          className="stats-card-actions__button"
          onClick={onShare}
          title="Share"
          aria-label="Share"
        >
          <ShareIcon />
        </button>
      )}
      {!onShare && (
        <button
          type="button"
          className="stats-card-actions__button"
          title="Share"
          aria-label="Share"
        >
          <ShareIcon />
        </button>
      )}

      {/* 3. Search — inline quick-search input */}
      {showQuickSearch && (
        <input
          className="stats-card-actions__search"
          type="search"
          value={quickSearch}
          onChange={(event) => handleQuickSearch(event.target.value)}
          placeholder="Search table..."
          aria-label="Search table"
          autoFocus
        />
      )}
      <button
        type="button"
        className="stats-card-actions__button"
        onClick={onSearch ?? toggleQuickSearch}
        title="Search"
        aria-label="Search"
      >
        <MagnifyingGlassIcon />
      </button>

      {/* 4. Filter */}
      {filterControl ? (
        filterControl
      ) : (
        <button
          type="button"
          className="stats-card-actions__button"
          onClick={onFilter ?? toggleColumnFilters}
          title="Filter"
          aria-label="Filter"
        >
          <FunnelIcon />
        </button>
      )}

      {/* 5. Refresh */}
      <button
        type="button"
        className="stats-card-actions__button"
        onClick={onRefresh}
        title="Refresh"
        aria-label="Refresh"
      >
        <ArrowPathIcon />
      </button>
    </div>
  );
};

export default TableToolbar;