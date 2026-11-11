import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import { ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, SelectField, TotalCard, count, initialPeriod, num, useSyncedParams } from "./reportKit";
import { BOOKS_API, SOURCE_FILTER, sourceLabel } from "./booksShared";
import { t } from "../../../i18n/i18n";

interface Line {
  accountCode?: string | null;
  accountName?: string | null;
  debit: number;
  credit: number;
  costCentre?: string | null;
  narration?: string | null;
}

interface Entry {
  id: number;
  entryNumber?: string | null;
  date: string;
  sourceModule?: string | null;
  description?: string | null;
  automatic: boolean;
  debit: number;
  credit: number;
  lines: Line[];
}

interface DayBookReport {
  rows: Entry[];
  totals: { entries: number; debit: number; credit: number };
}

type Row = Entry;
/** One line of an entry, for Excel / PDF (the screen shows the lines inside each entry). */
type ExportRow = { id: string; date: string; entryNumber: string; source: string; description: string; account: string; costCentre: string; debit: number; credit: number };

const MODULES = ["INVOICE"];

/** Every journal entry of a period with its lines (backlog 8.2.1.5): the company's day book. */
const DayBook: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [module, setModule] = useState(params.get("module") ?? "");
  const [report, setReport] = useState<DayBookReport | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<DayBookReport>(`${BOOKS_API}/day-book`, {
        params: { from: period.from, to: period.to, module: module || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the day book"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, module]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, module });

  const rows: Row[] = useMemo(() => report?.rows ?? [], [report]);
  const totals = report?.totals;
  const account = (l: Line) => [l.accountCode, l.accountName].filter(Boolean).join(" · ") || "—";

  const columns: ColumnDef<Row>[] = [
    { key: "date", label: "Date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    {
      key: "entryNumber",
      label: "Entry",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.entryNumber ?? "—"}</span>
          <span className="block text-xs text-slate-500">{sourceLabel(r.sourceModule)}</span>
        </span>
      ),
    },
    {
      key: "lines",
      label: "Accounts",
      render: (r) => (
        <span className="block text-sm">
          {r.description && <span className="mb-1 block text-slate-800">{r.description}</span>}
          {r.lines.map((l, i) => (
            <span key={i} className={`flex justify-between gap-4 text-xs ${num(l.credit) > 0 ? "ps-4 text-slate-500" : "text-slate-600"}`}>
              <span className="truncate">
                {account(l)}
                {l.costCentre ? ` · ${l.costCentre}` : ""}
              </span>
              <span className="shrink-0">{num(l.debit) > 0 ? `${t("Dr")} ${money(l.debit)}` : `${t("Cr")} ${money(l.credit)}`}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      key: "debit",
      label: "Amount",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.debit),
      render: (r) => <span className="text-sm font-semibold text-slate-900">{money(r.debit)}</span>,
    },
  ];

  const exportRows: ExportRow[] = useMemo(
    () =>
      rows.flatMap((r) =>
        r.lines.map((l, i) => ({
          id: `${r.id}-${i}`,
          date: i === 0 ? dateLabel(r.date) : "",
          entryNumber: i === 0 ? r.entryNumber ?? "" : "",
          source: i === 0 ? sourceLabel(r.sourceModule) : "",
          description: i === 0 ? r.description ?? "" : l.narration ?? "",
          account: account(l),
          costCentre: l.costCentre ?? "",
          debit: num(l.debit),
          credit: num(l.credit),
        }))
      ),
    [rows]
  );
  const exportColumns: ReportColumn<ExportRow>[] = [
    { label: "Date", value: (r) => r.date },
    { label: "Entry", value: (r) => r.entryNumber },
    { label: "Source", value: (r) => r.source },
    { label: "Description", value: (r) => r.description },
    { label: "Account", value: (r) => r.account },
    { label: "Cost centre", value: (r) => r.costCentre },
    { label: "Debit", value: (r) => r.debit, format: "money" },
    { label: "Credit", value: (r) => r.credit, format: "money" },
  ];
  const totalsRow: ExportRow | undefined = totals
    ? { id: "totals", date: "", entryNumber: t("Total"), source: "", description: "", account: "", costCentre: "", debit: totals.debit, credit: totals.credit }
    : undefined;
  const details = module ? [{ label: "Source", value: sourceLabel(module) }] : [];
  const balanced = totals ? Math.abs(num(totals.debit) - num(totals.credit)) < 0.01 : true;

  return (
    <>
      <PageMeta title={t("Day Book")} description="Every journal entry of a period" />
      <PageBreadcrumb pageTitle="Day Book" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Day Book", period, columns: exportColumns, rows: exportRows, totals: totalsRow, details }} />}
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          <SelectField label="Source" value={module} options={SOURCE_FILTER.map((o) => ({ value: o.value, label: t(o.label) }))} allLabel="All sources" onChange={setModule} />
        </FilterBar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TotalCard label="Entries" tone="cyan" value={String(totals?.entries ?? 0)} hint={count(exportRows.length, "line", "lines")} />
          <TotalCard label="Debits" tone="green" value={money(totals?.debit)} hint={balanced ? t("Debits equal credits") : t("Debits and credits differ")} />
          <TotalCard label="Credits" value={money(totals?.credit)} hint={t("In the company currency")} />
        </div>

        <p className="text-xs text-slate-500">
          {t("Every entry in the ledger dated in the period, automatic postings and entries made by hand, oldest first. A day book covers at most a year.")}{" "}
          <Link to="/journalEntries" className="font-medium text-cyan-700 hover:underline">
            {t("Journal Entries")}
          </Link>
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["entryNumber", "description"]}
          searchPlaceholder={t("Search entries")}
          defaultSortKey="date"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <BookOpenIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default DayBook;
