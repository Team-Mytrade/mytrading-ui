import React, { useState, useMemo } from "react";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import noDataImage from "../../images/no_data.png";


export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T, value: unknown) => React.ReactNode;
  sortValueGetter?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
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
  rowDetailsTitle?: string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
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
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function renderDetailValue(value: unknown): React.ReactNode {
  if (value == null || value === "") return <span className="text-gray-400">--</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">--</span>;
    return (
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return String(value);
}

function getDetailEntries<T>(row: T, columns: ColumnDef<T>[]) {
  const record = row as Record<string, unknown>;
  const orderedKeys = [
    ...columns.map((column) => column.key),
    ...Object.keys(record).filter((key) => !columns.some((column) => column.key === key)),
  ];

  return orderedKeys
    .filter((key, index, arr) => arr.indexOf(key) === index)
    .filter((key) => key !== "actions" && typeof record[key] !== "function")
    .map((key) => {
      const column = columns.find((item) => item.key === key);
      return {
        key,
        label: column?.label || formatDetailLabel(key),
        value: record[key],
      };
    });
}

function rowMatchesSearch<T>(
  row: T,
  term: string,
  fields?: (keyof T)[]
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
  columns: ColumnDef<T>[]
): T[] {
  const column = columns.find((c) => c.key === key);
  return [...rows].sort((a, b) => {
    let va = column?.sortValueGetter ? column.sortValueGetter(a) : getCellValue(a, key);
    let vb = column?.sortValueGetter ? column.sortValueGetter(b) : getCellValue(b, key);

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
  loading = false,
  emptyState,
  className = "",
}: ReusableTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder);
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);

  const filtered = useMemo(() => {
    return data.filter((row) => rowMatchesSearch(row, search, searchFields));
  }, [data, search, searchFields]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return applySorting(filtered, sortKey, sortOrder, columns);
  }, [filtered, sortKey, sortOrder, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const skeletonRowCount = Math.max(
    1,
    Math.min(pageSize, paginated.length || sorted.length || data.length || 1)
  );

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2)
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  }, [totalPages, safePage]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortOrder("asc"); }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleRowClick = (row: T, event: React.MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role='button']")) return;

    if (onRowClick) {
      onRowClick(row);
      return;
    }

    if (enableRowDetails) {
      setSelectedRow(row);
    }
  };

  const showEmptyState = !loading && paginated.length === 0;

  return (
    <div className={className}>

      {(searchable || toolbar) && (
        <div className="mb-3 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">

          {searchable && (
            <div className="relative flex-1 max-w-md w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-9 py-2 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto overflow-y-visible relative">
          <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/70">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={[
                      "px-4 py-3 text-xs font-semibold text-black dark:text-gray-100 uppercase tracking-wider select-none",
                      col.sortable
                        ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        : "",
                      col.headerClassName ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <span className="truncate" title={col.label}>{col.label}</span>
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
            </thead>

            {/* Body */}
            <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-800 dark:bg-gray-900">
              {loading ? (
                Array.from({ length: skeletonRowCount }).map((_, i) => (
                  <SkeletonRow key={i} cols={columns.length} />
                ))
              ) : (
                paginated.map((row, idx) => (
                  <tr
                    key={row.id ?? `row-${idx}`}
                    onClick={(event) => handleRowClick(row, event)}
                    className={[
                      "transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60",
                      onRowClick || enableRowDetails ? "cursor-pointer" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {columns.map((col) => (
                      (() => {
                        const value = getCellValue(row, col.key);
                        return (
                          <td
                            key={col.key}
                            className={[
                              "max-w-0 px-1.5 py-1.5 text-sm text-gray-700 dark:text-gray-300",
                              col.className ?? "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <div className="min-w-0 max-w-full" title={col.render ? getCellTitle(value) : undefined}>
                              {col.render
                                ? col.render(row, value)
                                : renderDefaultCell(value)}
                            </div>
                          </td>
                        );
                      })()
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && sorted.length > 0 && (
          <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-gray-100 dark:border-gray-800">

            <p className="text-xs text-gray-500 shrink-0 dark:text-gray-400">
              Showing{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {(safePage - 1) * pageSize + 1}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">{sorted.length}</span>{" "}
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

      {selectedRow && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <button
              type="button"
              aria-label="Close details"
              className="fixed inset-0 bg-gray-900/50"
              onClick={() => setSelectedRow(null)}
            />
            <div className="relative w-full max-w-3xl overflow-hidden rounded-xl bg-white text-left shadow-xl dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{rowDetailsTitle}</h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Read-only record details</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-5">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {getDetailEntries(selectedRow, columns).map((entry) => (
                    <div key={entry.key} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {entry.label}
                      </dt>
                      <dd className="mt-1 break-words text-sm text-gray-900 dark:text-gray-100">
                        {renderDetailValue(entry.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReusableTable;
