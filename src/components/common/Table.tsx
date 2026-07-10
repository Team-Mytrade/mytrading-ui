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
  loading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}


type SortOrder = "asc" | "desc";

function getCellValue<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
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
            "h-4 rounded-lg bg-gray-100",
            i === 0 ? "w-3/4" : i % 3 === 0 ? "w-1/4" : "w-1/2",
          ].join(" ")}
        />
      </td>
    ))}
  </tr>
);


const DefaultEmpty = () => (
  <div className="flex flex-col items-center py-4 text-gray-400">
    <div className="h-14 w-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
      <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
    </div>
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
  loading = false,
  emptyState,
  className = "",
}: ReusableTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder);
  const [page, setPage] = useState(1);

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

  return (
    <div className={className}>

      {(searchable || toolbar) && (
        <div className="mb-6 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">

          {searchable && (
            <div className="relative flex-1 max-w-md w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-9 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-visible shadow-sm">
        <div className="overflow-x-auto overflow-y-visible relative">
          <table className="min-w-full table-auto divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={[
                      "px-4 py-3 text-xs font-semibold text-black dark:text-white uppercase tracking-wider select-none whitespace-nowrap",
                      col.sortable
                        ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        : "",
                      col.headerClassName ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      {col.sortable &&
                        (sortKey === col.key ? (
                          sortOrder === "asc" ? (
                            <ArrowUpIcon className="h-3.5 w-3.5 text-cyan-600" />
                          ) : (
                            <ArrowDownIcon className="h-3.5 w-3.5 text-cyan-600" />
                          )
                        ) : (
                          <ChevronUpDownIcon className="h-3.5 w-3.5 text-gray-300" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                  <SkeletonRow key={i} cols={columns.length} />
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center">
                    {emptyState ?? <DefaultEmpty />}
                  </td>
                </tr>
              ) : (
                paginated.map((row, idx) => (
                  <tr
                    key={row.id ?? `row-${idx}`}
                    onClick={() => onRowClick?.(row)}
                    className={[
                      "transition-colors hover:bg-gray-50",
                      onRowClick ? "cursor-pointer" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={[
                          "px-4 py-3 text-xs text-gray-700 whitespace-nowrap",
                          col.className ?? "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {col.render
                          ? col.render(row, getCellValue(row, col.key))
                          : String(getCellValue(row, col.key) ?? "--")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && sorted.length > 0 && (
          <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-gray-100">

            <p className="text-xs text-gray-500 shrink-0">
              Showing{" "}
              <span className="font-medium text-gray-700">
                {(safePage - 1) * pageSize + 1}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-700">{sorted.length}</span>{" "}
              results
            </p>

            <div className="flex items-center gap-1">

              {/* First */}
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                title="First page"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <FirstPageIcon style={{ fontSize: 18 }} />
              </button>

              {/* Previous */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                title="Previous page"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                      ? "border-cyan-500 text-cyan-600 bg-white font-semibold"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
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
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRightIcon style={{ fontSize: 18 }} />
              </button>

              {/* Last */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                title="Last page"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <LastPageIcon style={{ fontSize: 18 }} />
              </button>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReusableTable;
