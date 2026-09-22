import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import noDataImage from "../../images/no_data.png";
import RecordDetailDrawer from "./RecordDetailDrawer";
import "./Table.css";

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T, value: unknown) => React.ReactNode;
  sortValueGetter?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
  /** Set false to omit this column from the toolbar-triggered filter row. */
  filterable?: boolean;
  /** Fixed enum values. When provided, this column renders a select instead of a text search. */
  filterOptions?: { label: string; value: string }[];
  /** Derives the value used by the column filter when the cell renders nested data. */
  filterValueGetter?: (row: T) => string | number | null | undefined;
  /**
   * Overrides how this column's value is shown in the row-details drawer
   * (e.g. mapping a boolean to "Active"/"Inactive" instead of the generic
   * "Yes"/"No"). Takes precedence over the raw value, render, and
   * sortValueGetter when present.
   */
  detailFormatter?: (row: T, value: unknown) => React.ReactNode;
  /**
   * Set true to keep this column in the table but omit it from the
   * row-details drawer — useful for columns that are guaranteed to
   * duplicate another field's value there.
   */
  excludeFromDetails?: boolean;
}

export interface ReusableTableProps<T extends { id?: number | string }> {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  pageSize?: number;
  defaultSortKey?: string;
  defaultSortOrder?: "asc" | "desc";
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  enableRowDetails?: boolean;
  /** Drawer heading, or a function that derives one from the selected row. */
  rowDetailsTitle?: string | ((row: T) => string);
  /** Optional supporting text shown beneath the drawer heading. */
  rowDetailsSubtitle?: string;
  /**
   * Raw field keys on the row object (not necessarily defined as columns)
   * to omit from the row-details drawer entirely — e.g. an internal
   * database id that isn't meant to be customer-facing.
   */
  hiddenDetailKeys?: string[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  showColumnFiltersInitially?: boolean;
}

type SortOrder = "asc" | "desc";

function getCellValue<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function renderDefaultCell(value: unknown): React.ReactNode {
  const text = String(value ?? "--");
  return (
    <span className="block max-w-full truncate" title={text}>
      {text}
    </span>
  );
}

function getCellTitle(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function formatDetailLabel(key: string): string {
  if (key === "fromDate") return "FROM DATE";
  if (key === "toDate") return "TO DATE";
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function formatPrimitiveValue(v: unknown): string {
  if (v == null || v === "") return "--";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  const str = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
    } catch {
      // ignore
    }
  }
  return str;
}

function isAddressObject(rec: Record<string, unknown>): boolean {
  const keys = Object.keys(rec).map((k) => k.toLowerCase());
  return keys.some(
    (k) =>
      k.includes("street") ||
      k.includes("city") ||
      k.includes("pincode") ||
      k.includes("postal") ||
      k.includes("zip"),
  );
}

function formatAddressObject(rec: Record<string, unknown>): string {
  const line1 = String(
    rec.addressLine1 || rec.street || rec.line1 || rec.address || "",
  );
  const line2 = String(rec.addressLine2 || rec.line2 || "");
  const city = String(rec.city || rec.district || "");
  const state = String(rec.state || rec.province || "");
  const pin = String(
    rec.pincode || rec.postalCode || rec.zipCode || rec.zip || "",
  );
  const country = String(rec.country || "");

  const parts = [line1, line2, city, state, pin, country].filter(Boolean);
  return parts.join(", ");
}

function formatPluralLabel(keyName: string, count: number): string {
  if (!keyName) return `${count} ${count === 1 ? "item" : "items"}`;
  const clean = keyName
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  if (clean.endsWith("s") && clean.length > 2) {
    const singular = clean.slice(0, -1);
    return `${count} ${count === 1 ? singular : clean}`;
  }
  return `${count} ${count === 1 ? clean : clean + "s"}`;
}

function getItemTitle(
  keyName: string,
  itemObj: Record<string, unknown> | null,
  idx: number,
): string {
  if (itemObj) {
    const firstName = String(itemObj.firstName || "");
    const lastName = String(itemObj.lastName || "");
    const fullName = `${firstName} ${lastName}`.trim();
    const name = String(
      itemObj.name ||
        itemObj.employeeName ||
        fullName ||
        itemObj.title ||
        itemObj.label ||
        itemObj.code ||
        "",
    ).trim();
    if (name) return name;
  }

  if (!keyName) return `Item #${idx + 1}`;
  const clean = keyName
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  let singular = clean;
  if (singular.endsWith("s") && singular.length > 2) {
    singular = singular.slice(0, -1);
  }
  const cap = singular.charAt(0).toUpperCase() + singular.slice(1);
  return `${cap} #${idx + 1}`;
}

function renderDetailValue(
  value: unknown,
  depth = 0,
  fieldName = "",
): React.ReactNode {
  if (React.isValidElement(value)) return value;
  if (value == null || value === "")
    return <span className="text-gray-400">--</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return formatPrimitiveValue(value);

  if (depth > 6)
    return (
      <span className="text-xs text-gray-500 font-mono">
        {JSON.stringify(value)}
      </span>
    );

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">--</span>;

    if (
      value.every(
        (v) =>
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean",
      )
    ) {
      return (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            >
              {formatPrimitiveValue(v)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3 w-full">
        {depth === 0 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/50 capitalize">
            {formatPluralLabel(fieldName, value.length)}
          </span>
        )}
        <div className="max-h-[380px] overflow-y-auto overflow-x-hidden space-y-3 pr-1">
          {value.map((item, idx) => {
            const itemObj =
              typeof item === "object" && item !== null
                ? (item as Record<string, unknown>)
                : null;
            const title = getItemTitle(fieldName, itemObj, idx);

            return (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm space-y-2 dark:border-gray-700 dark:bg-gray-900"
              >
                {itemObj && (
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                      {title}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      #{idx + 1}
                    </span>
                  </div>
                )}
                {renderDetailValue(item, depth + 1, fieldName)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;

    if (isAddressObject(rec)) {
      const addrStr = formatAddressObject(rec);
      if (addrStr) {
        return (
          <div className="py-1.5 px-3 rounded-lg bg-emerald-50/70 border border-emerald-100 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300">
            {addrStr}
          </div>
        );
      }
    }

    const entries = Object.entries(rec).filter(
      ([_, v]) =>
        v !== null && v !== undefined && v !== "" && typeof v !== "function",
    );

    if (entries.length === 0) return <span className="text-gray-400">--</span>;

    const scalars = entries.filter(
      ([_, v]) => typeof v !== "object" || v === null,
    );
    const complex = entries.filter(
      ([_, v]) => typeof v === "object" && v !== null,
    );

    return (
      <div className="space-y-3 w-full">
        {scalars.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {scalars.map(([k, v]) => (
              <div
                key={k}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80 border border-gray-100 dark:bg-gray-800/50 dark:border-gray-800 text-xs gap-1.5"
              >
                <span className="font-semibold text-gray-500 uppercase text-[10px] tracking-wider break-words pr-2">
                  {formatDetailLabel(k)}
                </span>
                <span className="font-semibold text-cyan-700 dark:text-cyan-400 break-words sm:text-right shrink-0">
                  {typeof v === "number"
                    ? `₹${v.toLocaleString()}`
                    : formatPrimitiveValue(v)}
                </span>
              </div>
            ))}
          </div>
        )}

        {complex.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {complex.map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-gray-100 bg-gray-50/40 p-2.5 space-y-1.5 dark:border-gray-800 dark:bg-gray-800/30"
              >
                <span className="font-semibold text-gray-500 uppercase text-[10px] tracking-wider block">
                  {formatDetailLabel(k)}
                </span>
                <div>{renderDetailValue(v, depth + 1, k)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return formatPrimitiveValue(value);
}

function getDetailEntries<T>(
  row: T,
  columns: ColumnDef<T>[],
  hiddenDetailKeys: string[] = [],
) {
  const record = row as Record<string, unknown>;
  const orderedKeys = [
    ...columns.map((column) => column.key),
    ...Object.keys(record).filter(
      (key) => !columns.some((column) => column.key === key),
    ),
  ];

  return orderedKeys
    .filter((key, index, arr) => arr.indexOf(key) === index)
    .filter((key) => key !== "actions" && typeof record[key] !== "function")
    .filter((key) => !hiddenDetailKeys.includes(key))
    .filter((key) => {
      const column = columns.find((item) => item.key === key);
      return !column?.excludeFromDetails;
    })
    .map((key) => {
      const column = columns.find((item) => item.key === key);
      let val: unknown;

      if (column?.detailFormatter) {
        // Column explicitly controls how it looks in the drawer — this
        // takes priority over the raw value/render/sortValueGetter
        // fallbacks below (e.g. a boolean "active" field rendering as
        // "Active"/"Inactive" instead of the generic Yes/No).
        val = column.detailFormatter(row, record[key]);
      } else {
        val = record[key];
        if ((val === undefined || val === null || val === "") && column) {
          if (column.sortValueGetter) {
            val = column.sortValueGetter(row) as any;
          } else if (column.render) {
            val = column.render(row, record[column.key]) as any;
          }
        }
      }

      return {
        key,
        label: column?.label || formatDetailLabel(key),
        value: val,
      };
    })
    .filter(
      (entry) =>
        entry.value !== undefined &&
        entry.value !== null &&
        entry.value !== "" &&
        entry.value !== "--",
    );
}

function isDashboardHighlight(value: unknown): boolean {
  return (
    value === null ||
    ["string", "number", "boolean"].includes(typeof value) ||
    React.isValidElement(value)
  );
}

function rowMatchesSearch<T>(
  row: T,
  term: string,
  fields?: (keyof T)[],
): boolean {
  if (!term.trim()) return true;
  const lower = term.toLowerCase();
  const keys = fields
    ? (fields as string[])
    : Object.keys(row as Record<string, unknown>);
  return keys.some((k) => {
    const v = getCellValue(row, k);
    return v != null && String(v).toLowerCase().includes(lower);
  });
}

function applySorting<T>(
  rows: T[],
  key: string,
  order: SortOrder,
  columns: ColumnDef<T>[],
): T[] {
  const column = columns.find((c) => c.key === key);
  return [...rows].sort((a, b) => {
    let va = column?.sortValueGetter
      ? column.sortValueGetter(a)
      : getCellValue(a, key);
    let vb = column?.sortValueGetter
      ? column.sortValueGetter(b)
      : getCellValue(b, key);

    if (typeof va === "number" && typeof vb === "number") {
      return order === "asc" ? va - vb : vb - va;
    }
    const sa = String(va ?? "");
    const sb = String(vb ?? "");
    return order === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}

const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div
          className={[
            "h-4 rounded-lg bg-gray-100 dark:bg-gray-800",
            i === 0 ? "w-3/4" : i % 3 === 0 ? "w-1/4" : "w-1/2",
          ].join(" ")}
        />
      </td>
    ))}
  </tr>
);

const EmptyImage = () => (
  <img
    src={noDataImage}
    alt="No data"
    className="mx-auto -mt-15 h-72 w-72 object-contain opacity-90 sm:h-80 sm:w-80 lg:h-[26rem] lg:w-[26rem] xl:h-[28rem] xl:w-[28rem]"
  />
);

const DefaultEmpty = () => (
  <div className="flex flex-col items-center py-4 text-gray-400 dark:text-gray-500">
    <EmptyImage />
    <span className="text-sm font-medium">No results found</span>
  </div>
);

export function ReusableTable<T extends { id?: number | string }>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = "Search...",
  searchFields,
  pageSize = 10,
  defaultSortKey,
  defaultSortOrder = "asc",
  toolbar,
  onRowClick,
  enableRowDetails = true,
  rowDetailsTitle = "Row Details",
  rowDetailsSubtitle = "Read-only record details",
  hiddenDetailKeys = [],
  loading = false,
  emptyState,
  className = "",
  align = "left",
  showColumnFiltersInitially = false,
}: ReusableTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder);
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(() => {
    const reservedSidebarWidth = window.innerWidth >= 1024 ? 220 : 0;
    return Math.max(360, window.innerWidth - reservedSidebarWidth);
  });
  const [isDrawerResizing, setIsDrawerResizing] = useState(false);
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);
  const [showColumnFilters, setShowColumnFilters] = useState(showColumnFiltersInitially);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [columnPickerPosition, setColumnPickerPosition] = useState<{ left: number; top: number } | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => columns.map((column) => column.key));
  const tableShellRef = useRef<HTMLDivElement | null>(null);
  const [viewportPageSize, setViewportPageSize] = useState(pageSize);
  const [isLargeScreen, setIsLargeScreen] = useState(
    () => window.innerWidth >= 1024,
  );

  useEffect(() => {
    const updateScreenSize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener("resize", updateScreenSize);
    return () => window.removeEventListener("resize", updateScreenSize);
  }, []);

  useEffect(() => {
    if (!isDrawerResizing) return;
    const resizeDrawer = (event: PointerEvent) => {
      const reservedSidebarWidth = window.innerWidth >= 1024 ? 220 : 0;
      const maxWidth = Math.max(360, window.innerWidth - reservedSidebarWidth);
      setDrawerWidth(Math.max(360, Math.min(maxWidth, window.innerWidth - event.clientX)));
    };
    const stopResizing = () => setIsDrawerResizing(false);
    document.addEventListener("pointermove", resizeDrawer);
    document.addEventListener("pointerup", stopResizing);
    return () => {
      document.removeEventListener("pointermove", resizeDrawer);
      document.removeEventListener("pointerup", stopResizing);
    };
  }, [isDrawerResizing]);

  useEffect(() => {
    const applyQuickSearch = (event: Event) => {
      setSearch(String((event as CustomEvent<string>).detail ?? ""));
      setPage(1);
    };
    window.addEventListener("reusable-table:quick-search", applyQuickSearch);
    return () => window.removeEventListener("reusable-table:quick-search", applyQuickSearch);
  }, []);

  useEffect(() => {
    setVisibleColumnKeys((current) => {
      const available = new Set(columns.map((column) => column.key));
      const retained = current.filter((key) => available.has(key));
      const added = columns.map((column) => column.key).filter((key) => !current.includes(key));
      return [...retained, ...added];
    });
  }, [columns]);

  useEffect(() => {
    const toggleColumnPicker = (event: Event) => {
      const detail = (event as CustomEvent<{ left: number; bottom: number } | undefined>).detail;
      setColumnPickerPosition(detail ? { left: Math.max(12, detail.left - 182), top: detail.bottom + 7 } : null);
      setShowColumnPicker((current) => !current);
    };
    window.addEventListener("reusable-table:toggle-columns", toggleColumnPicker);
    return () => window.removeEventListener("reusable-table:toggle-columns", toggleColumnPicker);
  }, []);

  useEffect(() => {
    const toggleColumnFilters = () => setShowColumnFilters((current) => !current);
    window.addEventListener("reusable-table:toggle-column-filters", toggleColumnFilters);
    return () => window.removeEventListener("reusable-table:toggle-column-filters", toggleColumnFilters);
  }, []);

  const tableWorkspaceLeft = isLargeScreen ? 60 : 0;

  const getFilterOptions = (column: ColumnDef<T>) => {
    if (column.filterOptions) return column.filterOptions;
    if (!/(status|state|stage|type|priority|enum)/i.test(column.key)) return [];
    return [...new Set(data.map((row) => String(column.filterValueGetter?.(row) ?? getCellValue(row, column.key) ?? "")).filter(Boolean))]
      .sort()
      .map((value) => ({ label: value, value }));
  };
  const visibleColumns = columns.filter((column) => visibleColumnKeys.includes(column.key));

  const filtered = useMemo(() => data.filter((row) => {
    if (!rowMatchesSearch(row, search, searchFields)) return false;
    return columns.every((column) => {
      const filter = columnFilters[column.key]?.trim().toLowerCase();
      if (!filter) return true;
      const value = String(column.filterValueGetter?.(row) ?? getCellValue(row, column.key) ?? "").toLowerCase();
      return getFilterOptions(column).length ? value === filter : value.includes(filter);
    });
  }), [data, search, searchFields, columns, columnFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return applySorting(filtered, sortKey, sortOrder, columns);
  }, [filtered, sortKey, sortOrder, columns]);

  useEffect(() => {
    const calculatePageSize = () => {
      if (!tableShellRef.current || typeof window === "undefined") {
        setViewportPageSize(pageSize);
        return;
      }

      const { top } = tableShellRef.current.getBoundingClientRect();
      const tableHeaderHeight = 41;
      const paginationHeight = 57;
      const bottomPadding = 12;
      const rowHeight = 57;
      const availableHeight =
        window.innerHeight -
        top -
        tableHeaderHeight -
        paginationHeight -
        bottomPadding;
      const rowsThatFit = Math.max(1, Math.floor(availableHeight / rowHeight));

      setViewportPageSize(Math.max(1, Math.min(pageSize, rowsThatFit)));
    };

    calculatePageSize();
    window.addEventListener("resize", calculatePageSize);
    window.addEventListener("orientationchange", calculatePageSize);

    return () => {
      window.removeEventListener("resize", calculatePageSize);
      window.removeEventListener("orientationchange", calculatePageSize);
    };
  }, [pageSize, searchable, toolbar, data.length, isTableFullscreen]);

  useEffect(() => {
    if (!isTableFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsTableFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isTableFullscreen]);

  const effectivePageSize = Math.max(1, viewportPageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (safePage - 1) * effectivePageSize,
    safePage * effectivePageSize,
  );
  const skeletonRowCount = Math.max(
    1,
    Math.min(
      effectivePageSize,
      paginated.length || sorted.length || data.length || 1,
    ),
  );

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2)
      return [
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  }, [totalPages, safePage]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const toggleColumnVisibility = (key: string) => {
    setVisibleColumnKeys((current) => current.includes(key) ? current.filter((columnKey) => columnKey !== key) : [...current, key]);
  };

  const handleRowClick = (
    row: T,
    event: React.MouseEvent<HTMLTableRowElement>,
  ) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role='button']"))
      return;

    if (onRowClick) {
      onRowClick(row);
      return;
    }

    if (enableRowDetails) {
      setSelectedRow(row);
    }
  };

  const showEmptyState = !loading && paginated.length === 0;
  const selectedRowDetailsTitle = selectedRow
    ? typeof rowDetailsTitle === "function"
      ? rowDetailsTitle(selectedRow)
      : rowDetailsTitle
    : "Row Details";
  const selectedDetailEntries = selectedRow
    ? getDetailEntries(selectedRow, columns, hiddenDetailKeys)
    : [];
  const summaryEntries = selectedDetailEntries
    .filter((entry) => isDashboardHighlight(entry.value))
    .slice(0, 4);
  const summaryKeys = new Set(summaryEntries.map((entry) => entry.key));
  const informationEntries = selectedDetailEntries.filter(
    (entry) => !summaryKeys.has(entry.key),
  );

  return (
    <div
      style={
        isTableFullscreen ? { left: `${tableWorkspaceLeft}px` } : undefined
      }
      className={[
        isTableFullscreen
          ? "fixed top-14 right-0 bottom-0 z-[100] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
          : "my-[3px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {(searchable || toolbar) && (
        <div className="my-[3px] flex flex-col gap-[3px] sm:flex-row items-start sm:items-center justify-between">
          {searchable && (
            <div className="relative flex-1 max-w-md w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-9 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              {search && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {toolbar && (
            <div className="flex items-center gap-2 shrink-0">{toolbar}</div>
          )}
        </div>
      )}

      {showEmptyState ? (
        <div className="flex min-h-[340px] items-start justify-center pb-0 pt-0 text-center sm:min-h-[390px] lg:min-h-[430px] xl:min-h-[460px]">
          {emptyState ? (
            <div className="table-empty-with-image flex flex-col items-center justify-center">
              <EmptyImage />
              {emptyState}
            </div>
          ) : (
            <DefaultEmpty />
          )}
        </div>
      ) : (
        <div
          ref={tableShellRef}
          className={[
            "common-data-table relative rounded-lg border border-gray-200 bg-white shadow-none dark:border-gray-800 dark:bg-gray-900",
            isTableFullscreen
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "overflow-visible",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={() => setIsTableFullscreen((current) => !current)}
            className="absolute right-2 top-1.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-cyan-300"
            title={
              isTableFullscreen
                ? "Exit full screen (Esc)"
                : "View table in full screen"
            }
            aria-label={
              isTableFullscreen
                ? "Exit table full screen"
                : "View table in full screen"
            }
          >
            {isTableFullscreen ? (
              <ArrowsPointingInIcon className="h-4 w-4" />
            ) : (
              <ArrowsPointingOutIcon className="h-4 w-4" />
            )}
          </button>
          {showColumnPicker && (
            <div className="common-data-table__column-picker" style={columnPickerPosition ? { position: "fixed", left: columnPickerPosition.left, top: columnPickerPosition.top } : undefined} role="dialog" aria-label="Choose visible columns">
              <p>Columns</p>
              {columns.map((column) => (
                <label key={column.key}>
                  <input type="checkbox" checked={visibleColumnKeys.includes(column.key)} onChange={() => toggleColumnVisibility(column.key)} />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          )}
          <div
            className={
              isTableFullscreen
                ? "min-h-0 flex-1 overflow-auto"
                : "relative overflow-x-auto overflow-y-visible"
            }
          >
            <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  {visibleColumns.map((col, index) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={[
                        "px-3 py-3 text-xs font-semibold uppercase tracking-wider text-black select-none dark:text-gray-100",
                        align === "center"
                          ? "text-center"
                          : align === "right"
                            ? "text-right"
                            : "text-left",
                        col.sortable
                          ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          : "",
                        col.headerClassName ?? "",
                        index === visibleColumns.length - 1 ? "!pr-12" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span
                        className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${align === "center" ? "justify-center w-full" : align === "right" ? "justify-end w-full" : ""}`}
                      >
                        <span className="truncate" title={col.label}>
                          {col.label}
                        </span>
                        {col.sortable &&
                          (sortKey === col.key ? (
                            sortOrder === "asc" ? (
                              <ArrowUpIcon className="h-3.5 w-3.5 text-cyan-600" />
                            ) : (
                              <ArrowDownIcon className="h-3.5 w-3.5 text-cyan-600" />
                            )
                          ) : (
                            <ChevronUpDownIcon className="h-3.5 w-3.5 text-gray-300 dark:text-gray-500" />
                          ))}
                      </span>
                    </th>
                  ))}
                </tr>
                {showColumnFilters && (
                  <tr className="common-data-table__filters">
                    {visibleColumns.map((column) => {
                      const options = getFilterOptions(column);
                      const canFilter = column.filterable !== false && column.key !== "actions";
                      return (
                        <th key={`${column.key}-filter`} className="px-2 py-2">
                          {canFilter && options.length > 0 ? (
                            <select value={columnFilters[column.key] ?? ""} onChange={(event) => handleColumnFilter(column.key, event.target.value)} aria-label={`Filter ${column.label}`}>
                              <option value="">All</option>
                              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          ) : canFilter ? (
                            <input type="search" value={columnFilters[column.key] ?? ""} onChange={(event) => handleColumnFilter(column.key, event.target.value)} placeholder={`Search ${column.label}`} aria-label={`Search ${column.label}`} />
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                )}
              </thead>

              {/* Body */}
              <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-800 dark:bg-gray-900">
                {loading
                  ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                      <SkeletonRow key={i} cols={visibleColumns.length} />
                    ))
                  : paginated.map((row, idx) => (
                      <tr
                        key={row.id ?? `row-${idx}`}
                        onClick={(event) => handleRowClick(row, event)}
                        className={[
                          "transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60",
                          onRowClick || enableRowDetails
                            ? "cursor-pointer"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        {visibleColumns.map((col) =>
                          (() => {
                            const value = getCellValue(row, col.key);
                            return (
                              <td
                                key={col.key}
                                className={[
                                  "px-3 py-2 text-sm text-gray-700 dark:text-gray-300 overflow-hidden text-ellipsis",
                                  align === "center"
                                    ? "text-center"
                                    : align === "right"
                                      ? "text-right"
                                      : "text-left",
                                  col.className ?? "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <div
                                  className={`min-w-0 max-w-full ${align === "center" ? "flex justify-center text-center items-center" : align === "right" ? "flex justify-end text-right items-center" : ""}`}
                                  title={
                                    col.render ? getCellTitle(value) : undefined
                                  }
                                >
                                  {col.render
                                    ? col.render(row, value)
                                    : renderDefaultCell(value)}
                                </div>
                              </td>
                            );
                          })(),
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {!loading && sorted.length > 0 && (
            <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 shrink-0 dark:text-gray-400">
                Showing{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {(safePage - 1) * effectivePageSize + 1}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {sorted.length}
                </span>{" "}
                results
              </p>

              <div className="flex items-center gap-1">
                {/* First */}
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  title="First page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <FirstPageIcon style={{ fontSize: 18 }} />
                </button>

                {/* Previous */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  title="Previous page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <ChevronLeftIcon style={{ fontSize: 18 }} />
                </button>

                {/* Page number buttons */}
                {pageNumbers.map((num) => (
                  <button
                    key={num}
                    onClick={() => setPage(num)}
                    className={[
                      "w-8 h-8 rounded-lg text-xs font-medium transition-colors border",
                      safePage === num
                        ? "border-cyan-500 text-cyan-600 bg-white font-semibold dark:bg-cyan-950/30 dark:text-cyan-300"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
                    ].join(" ")}
                  >
                    {num}
                  </button>
                ))}

                {/* Next */}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  title="Next page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <ChevronRightIcon style={{ fontSize: 18 }} />
                </button>

                {/* Last */}
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  title="Last page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <LastPageIcon style={{ fontSize: 18 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <RecordDetailDrawer
        isOpen={Boolean(selectedRow)}
        title={selectedRowDetailsTitle}
        subtitle={rowDetailsSubtitle}
        onClose={() => setSelectedRow(null)}
        drawerWidth={drawerWidth}
        isResizing={isDrawerResizing}
        resizeHandle={<button type="button" className="record-detail-drawer__resize-handle" onPointerDown={(event) => { event.preventDefault(); setIsDrawerResizing(true); }} aria-label="Resize details panel" />}
      >
        {selectedRow && (
          <div className="record-detail-dashboard">
            {summaryEntries.length > 0 && (
              <section className="record-detail-dashboard__summary" aria-label="Record summary">
                {summaryEntries.map((entry) => (
                  <div key={entry.key} className="record-detail-dashboard__metric">
                    <span>{entry.label}</span>
                    <strong>{renderDetailValue(entry.value, 0, entry.key)}</strong>
                  </div>
                ))}
              </section>
            )}

            {informationEntries.length > 0 && (
              <section className="record-detail-dashboard__section" aria-labelledby="record-information-title">
                <div className="record-detail-dashboard__section-heading">
                  <div>
                    <p>Record information</p>
                    <h3 id="record-information-title">Details</h3>
                  </div>
                  <span>{informationEntries.length} fields</span>
                </div>
                <dl className="record-detail-drawer__details">
                  {informationEntries.map((entry) => {
                    const isComplex = typeof entry.value === "object" && entry.value !== null;
                    return (
                      <div key={entry.key} className={`record-detail-drawer__field ${isComplex ? "record-detail-drawer__field--wide" : ""}`}>
                        <dt>{entry.label}</dt>
                        <dd>{renderDetailValue(entry.value, 0, entry.key)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            )}
          </div>
        )}
      </RecordDetailDrawer>
    </div>
  );
}

export default ReusableTable;
