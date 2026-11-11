import React, { useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { ArrowDownTrayIcon, DocumentTextIcon, ExclamationTriangleIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { exportListingPdf } from "../../../components/common/export";
import { ToasterService } from "../../../Services/ToasterService";
import { AuthContext } from "../../../context/AuthContext";
import { hasPermission } from "../../../access/access";
import { toLocalIsoDate, todayIso } from "../../../utils/localDate";
import { formatDate } from "../../../company/format";
import { INVOICE_API, money } from "../../Invoice/invoiceShared";
import { t } from "../../../i18n/i18n";

/* ================= Periods ================= */

// "all": no dates at all, for reports of what is open now (open orders, dispatches not invoiced)
export type PeriodPreset = "all" | "this-month" | "last-month" | "this-quarter" | "last-quarter" | "this-year" | "last-year" | "custom";
export interface Period {
  preset: PeriodPreset;
  from: string;
  to: string;
}

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-quarter", label: "This quarter" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "this-year", label: "This year" },
  { value: "last-year", label: "Last year" },
  { value: "custom", label: "Custom" },
];

/** The dates of a preset period (calendar months, quarters and years), up to today for the current one. */
export const periodFor = (preset: PeriodPreset, today = new Date()): Period => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const q = Math.floor(m / 3) * 3;
  const range = (from: Date, to: Date): Period => ({ preset, from: toLocalIsoDate(from), to: toLocalIsoDate(to) });
  switch (preset) {
    case "all":
      return { preset, from: "", to: "" };
    case "last-month":
      return range(new Date(y, m - 1, 1), new Date(y, m, 0));
    case "this-quarter":
      return range(new Date(y, q, 1), today);
    case "last-quarter":
      return range(new Date(y, q - 3, 1), new Date(y, q, 0));
    case "this-year":
      return range(new Date(y, 0, 1), today);
    case "last-year":
      return range(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31));
    default:
      return range(new Date(y, m, 1), today);
  }
};

export const periodLabel = (period: Period) =>
  period.from && period.to ? `${formatDate(period.from)} – ${formatDate(period.to)}` : `${t("All dates")} · ${t("as of")} ${formatDate(todayIso())}`;

/**
 * Keeps the report's filters in the address (empty ones left out). Runs only when a value changes, not when the
 * router hands out a new setter.
 */
export const useSyncedParams = (
  setParams: (next: Record<string, string>, options: { replace: boolean }) => void,
  values: Record<string, string | undefined>
) => {
  const setter = useRef(setParams);
  setter.current = setParams;
  const key = JSON.stringify(values);
  useEffect(() => {
    const next = Object.fromEntries(Object.entries(JSON.parse(key) as Record<string, string>).filter(([, v]) => v));
    setter.current(next, { replace: true });
  }, [key]);
};

/** The period from the address (?from=&to=), else the report's default (this month, or all dates for what is open now). */
export const initialPeriod = (params: URLSearchParams, fallback: PeriodPreset = "this-month"): Period => {
  const from = params.get("from");
  const to = params.get("to");
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return from && to && iso.test(from) && iso.test(to) ? { preset: "custom", from, to } : periodFor(fallback);
};

const inputClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20";

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium text-slate-600">{t(label)}</span>
    {children}
  </label>
);

/** allowAll: offers "All dates" (no period) first, for reports of what is open now. */
export const PeriodPicker: React.FC<{ value: Period; onChange: (period: Period) => void; allowAll?: boolean; label?: string }> = ({
  value,
  onChange,
  allowAll,
  label = "Period",
}) => {
  const presets = allowAll ? [{ value: "all" as PeriodPreset, label: "All dates" }, ...PERIOD_PRESETS] : PERIOD_PRESETS;
  const today = todayIso();
  return (
    <>
      <Field label={label}>
        <select
          className={inputClass}
          value={value.preset}
          onChange={(e) => {
            const preset = e.target.value as PeriodPreset;
            onChange(preset === "custom" ? { preset, from: value.from || periodFor("this-month").from, to: value.to || today } : periodFor(preset));
          }}
        >
          {presets.map((p) => (
            <option key={p.value} value={p.value}>
              {t(p.label)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="From">
        <input type="date" className={inputClass} value={value.from} max={value.to || undefined} onChange={(e) => e.target.value && onChange({ preset: "custom", from: e.target.value, to: value.to || today })} />
      </Field>
      <Field label="To">
        <input type="date" className={inputClass} value={value.to} min={value.from || undefined} onChange={(e) => e.target.value && onChange({ preset: "custom", from: value.from || e.target.value, to: e.target.value })} />
      </Field>
    </>
  );
};

/**
 * The service's notes on a report (fixed texts, translated); when some currencies had no exchange rate, they are named
 * after the note.
 */
export const ReportWarnings: React.FC<{ warnings?: string[] | null; missingRates?: string[] | null }> = ({ warnings, missingRates }) => (
  <>
    {(warnings ?? []).map((w) => (
      <p key={w} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
        <span>
          {t(w)}
          {w.startsWith("Some amounts have no exchange rate") && (missingRates ?? []).length > 0 ? ` (${(missingRates ?? []).join(", ")})` : ""}
        </span>
      </p>
    ))}
  </>
);

export interface Option {
  value: string;
  label: string;
}

export const SelectField: React.FC<{ label: string; value: string; options: Option[]; allLabel: string; onChange: (value: string) => void }> = ({
  label,
  value,
  options,
  allLabel,
  onChange,
}) => (
  <Field label={label}>
    <select className={`${inputClass} min-w-[11rem]`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t(allLabel)}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </Field>
);

/** Filter bar: period and filters on the left, export buttons on the right. */
export const FilterBar: React.FC<{ children: React.ReactNode; actions?: React.ReactNode }> = ({ children, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-end gap-3">{children}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/* ================= Filter lists ================= */

const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: unknown })?.content) ? (data as { content: T[] }).content : [];

/**
 * Customers and sales persons for the sales report filters. Each list needs its own module's rights; one the user
 * can't read stays empty and its filter is hidden.
 */
export const useSalesFilterOptions = () => {
  const [customers, setCustomers] = useState<Option[]>([]);
  const [salesPersons, setSalesPersons] = useState<Option[]>([]);
  useEffect(() => {
    const quiet = { skipSessionExpiredHandling: true } as object;
    axios
      .get("/v1/api/common/customers", quiet)
      .then((r) =>
        setCustomers(
          asArray<{ id: number; customerName?: string; customerCode?: string }>(r.data)
            .map((c) => ({ value: String(c.id), label: c.customerName || c.customerCode || `#${c.id}` }))
            .sort((a, b) => a.label.localeCompare(b.label))
        )
      )
      .catch(() => setCustomers([]));
    axios
      .get(`${INVOICE_API}/commission/sales-persons`, quiet)
      .then((r) =>
        setSalesPersons(
          asArray<{ id: number; name?: string; code?: string | null }>(r.data)
            .map((p) => ({ value: String(p.id), label: p.name || p.code || `#${p.id}` }))
            .sort((a, b) => a.label.localeCompare(b.label))
        )
      )
      .catch(() => setSalesPersons([]));
  }, []);
  return { customers, salesPersons };
};

/** Vendors for the purchase report filters (the common vendor list); hidden when the user can't read it. */
export const useVendorOptions = () => {
  const [vendors, setVendors] = useState<Option[]>([]);
  useEffect(() => {
    axios
      .get("/v1/api/common/vendors", { skipSessionExpiredHandling: true } as object)
      .then((r) =>
        setVendors(
          asArray<{ id: number; name?: string; vendorName?: string; vendorCode?: string }>(r.data)
            .map((v) => ({ value: String(v.id), label: v.name || v.vendorName || v.vendorCode || `#${v.id}` }))
            .sort((a, b) => a.label.localeCompare(b.label))
        )
      )
      .catch(() => setVendors([]));
  }, []);
  return vendors;
};

/* ================= Totals and chart ================= */

export const TotalCard: React.FC<{ label: string; value: string; hint?: string; tone?: "cyan" | "green" | "red" | "slate" }> = ({
  label,
  value,
  hint,
  tone = "slate",
}) => {
  const tones = {
    cyan: "border-cyan-100 bg-cyan-50/60 text-cyan-700",
    green: "border-green-100 bg-green-50/60 text-green-700",
    red: "border-red-100 bg-red-50/60 text-red-700",
    slate: "border-slate-200 bg-white text-slate-600",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{t(label)}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};

/** Horizontal bars, largest first; negative values show as an empty bar with the figure in red. */
export const BarList: React.FC<{ title: string; rows: { key: string; label: string; value: number; display: string }[]; empty: string }> = ({
  title,
  rows,
  empty,
}) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{t(title)}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{t(empty)}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[minmax(6rem,12rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-slate-600" title={row.label}>
                {row.label}
              </span>
              <span className="h-2 rounded-full bg-slate-100">
                <span className="block h-2 rounded-full bg-cyan-500" style={{ width: `${(Math.max(0, row.value) / max) * 100}%` }} />
              </span>
              <span className={`font-medium ${row.value < 0 ? "text-red-600" : "text-slate-800"}`}>{row.display}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/* ================= Export and print ================= */

export interface ReportColumn<T> {
  label: string;
  /** Excel gets this value as it is (numbers stay numbers). */
  value: (row: T) => string | number | null | undefined;
  /** How the PDF and print view show a number. */
  format?: "money" | "number" | "percent";
  align?: "left" | "right";
}

const shown = <T,>(column: ReportColumn<T>, row: T): string | number | null | undefined => {
  const value = column.value(row);
  if (value === null || value === undefined || value === "" || !column.format) return value;
  const n = num(value);
  if (column.format === "money") return money(n);
  if (column.format === "percent") return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

export interface ReportExport<T> {
  title: string;
  period: Period;
  columns: ReportColumn<T>[];
  rows: T[];
  /** Shown under the rows in Excel and the PDF. */
  totals?: T;
  /** Filters and other notes for the header, e.g. "Customer: Acme". */
  details?: { label: string; value: string }[];
}

/** May this user export a report of these modules (MODULE:EXPORT or MODULE:ADMIN in any of them)? */
export const useCanExport = (modules: string[]) => {
  const { access } = useContext(AuthContext);
  return access.superAdmin || modules.some((m) => hasPermission(access, `${m}:EXPORT`) || hasPermission(access, `${m}:ADMIN`));
};

const fileName = (title: string, period: Period) => `${title.replace(/[^\w-]+/g, "_")}_${period.from || "all"}_${period.to || todayIso()}`;

export const exportExcel = <T,>({ title, period, columns, rows, totals, details = [] }: ReportExport<T>) => {
  const header = columns.map((c) => t(c.label));
  const line = (row: T) => columns.map((c) => c.value(row) ?? "");
  const sheet = XLSX.utils.aoa_to_sheet([
    [t(title)],
    [`${t("Period")}: ${periodLabel(period)}`],
    ...details.map((d) => [`${t(d.label)}: ${d.value}`]),
    [],
    header,
    ...rows.map(line),
    ...(totals ? [line(totals)] : []),
  ]);
  sheet["!cols"] = columns.map((c) => ({ wch: Math.max(10, t(c.label).length + 2) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, t(title).slice(0, 31));
  XLSX.writeFile(book, `${fileName(title, period)}.xlsx`);
};

export const exportPdf = async <T extends object>({ title, period, columns, rows, totals, details = [] }: ReportExport<T>, print = false) => {
  await exportListingPdf<T>({
    title: t(title),
    subtitle: `${t("Period")}: ${periodLabel(period)}`,
    data: totals ? [...rows, totals] : rows,
    columns: columns.map((c) => ({ header: t(c.label), accessor: (row: T) => shown(c, row), align: c.align ?? (c.format ? "right" : undefined) })),
    metadata: details.map((d) => ({ label: t(d.label), value: d.value })),
    reportLabel: t("Report"),
    fileName: fileName(title, period),
    includeSerialNumber: false,
    emptyMessage: t("Nothing in this period"),
    print,
  });
};

const buttonClass =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/** Excel, PDF and Print for a report; hidden for users without the export right. */
export function ExportButtons<T extends object>({ report, modules, disabled }: { report: ReportExport<T>; modules: string[]; disabled?: boolean }) {
  const canExport = useCanExport(modules);
  const [busy, setBusy] = useState(false);
  if (!canExport) return null;
  const run = async (work: () => void | Promise<void>) => {
    try {
      setBusy(true);
      await work();
    } catch {
      ToasterService.error(t("The report could not be exported"));
    } finally {
      setBusy(false);
    }
  };
  const off = disabled || busy;
  return (
    <>
      <button type="button" className={buttonClass} disabled={off} onClick={() => run(() => exportExcel(report))}>
        <ArrowDownTrayIcon className="h-4 w-4" />
        {t("Excel")}
      </button>
      <button type="button" className={buttonClass} disabled={off} onClick={() => run(() => exportPdf(report))}>
        <DocumentTextIcon className="h-4 w-4" />
        {t("PDF")}
      </button>
      <button type="button" className={buttonClass} disabled={off} onClick={() => run(() => exportPdf(report, true))}>
        <PrinterIcon className="h-4 w-4" />
        {t("Print")}
      </button>
    </>
  );
}

/** "1 invoice", "3 invoices" (each wording translated). */
export const count = (n: number | null | undefined, one: string, many: string) => `${n ?? 0} ${t((n ?? 0) === 1 ? one : many)}`;

/** Numbers from the API (BigDecimal arrives as a number or a string). */
export const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
