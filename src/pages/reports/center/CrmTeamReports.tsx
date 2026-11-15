import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, money } from "../../Invoice/invoiceShared";
import { useUserDirectory } from "../../../access/useUserDirectory";
import {
  BarList,
  ExportButtons,
  FilterBar,
  Option,
  Period,
  PeriodPicker,
  ReportColumn,
  ReportWarnings,
  SelectField,
  TotalCard,
  count,
  initialPeriod,
  num,
  useSyncedParams,
} from "./reportKit";
import { t } from "../../../i18n/i18n";

// The CRM team reports (backlog 8.3.7): forecast by close month, by owner, by lead source, and win / loss reasons.
// The CRM service counts only the leads and deals the viewer may see; money is in the company's currency.

const API = "/v1/api/crm/report-center";
const MODULES = ["CRM"];
const UNASSIGNED = "__unassigned__";

const pct = (value?: number | null) => (value === null || value === undefined ? "—" : `${num(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`);
const monthLabel = (ym?: string | null) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
};
const ownerLabel = (owner?: string | null, name?: string | null) => (owner ? name || owner : t("Unassigned"));

/** The owner filter: every login, plus records nobody owns. */
const useOwnerOptions = (): Option[] => {
  const { users } = useUserDirectory();
  return useMemo(
    () => [{ value: UNASSIGNED, label: t("Unassigned") }, ...users.map((u) => ({ value: u.username, label: u.fullName || u.username }))],
    [users]
  );
};

/** The forecast looks ahead: this month and the five after it (the presets stop at today). */
const nextSixMonths = (): Period => {
  const now = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { preset: "custom", from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 6, 0)) };
};

/** Loads one report for the period (and owner), keeping the filters in the address. */
function useReport<T>(path: string, fallback: Period["preset"] | (() => Period), withOwner: boolean, failMessage: string) {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() =>
    typeof fallback === "function" && !(params.get("from") && params.get("to")) ? fallback() : initialPeriod(params, typeof fallback === "function" ? "this-month" : fallback)
  );
  const [owner, setOwner] = useState(withOwner ? params.get("owner") ?? "" : "");
  const [report, setReport] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<T>(`${API}/${path}`, {
        params: { from: period.from || undefined, to: period.to || undefined, owner: owner || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data ?? null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, failMessage));
    } finally {
      setLoading(false);
    }
  }, [path, period.from, period.to, owner, failMessage]);

  useEffect(() => {
    load();
  }, [load]);
  useSyncedParams(setParams, withOwner ? { from: period.from, to: period.to, owner } : { from: period.from, to: period.to });
  return { period, setPeriod, owner, setOwner, report, loading };
}

const right = { sortable: true, headerClassName: "text-right", className: "text-right" };
const Note: React.FC<{ text: string }> = ({ text }) => <p className="text-xs text-slate-500">{t(text)}</p>;
const Empty: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-8">
    <ChartBarIcon className="mb-3 h-12 w-12 text-gray-400" />
    <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
  </div>
);

/* ================= Forecast by close month ================= */

interface ForecastRow {
  month: string | null;
  openDeals: number;
  openValue: number;
  weightedValue: number;
  wonDeals: number;
  wonValue: number;
  lostDeals: number;
}
interface Forecast {
  currency: string | null;
  rows: ForecastRow[];
  totals: ForecastRow;
  overdueDeals: number;
  overdueValue: number;
  noCloseDateDeals: number;
  noCloseDateValue: number;
  missingRates?: string[];
  warnings?: string[];
}

export const CrmForecast: React.FC = () => {
  const { period, setPeriod, owner, setOwner, report, loading } = useReport<Forecast>("forecast", nextSixMonths, true, "Failed to load the forecast");
  const owners = useOwnerOptions();
  const cur = report?.currency;
  const rows = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.month ?? "" })), [report]);
  type Row = (typeof rows)[number];
  const chart = rows.map((r) => ({ key: r.id, label: monthLabel(r.month), value: num(r.weightedValue), display: `${money(r.weightedValue, cur)} · ${t("of")} ${money(r.openValue, cur)}` }));
  const columns: ColumnDef<Row>[] = [
    { key: "month", label: "Close month", sortable: true, render: (r) => <span className="text-sm font-semibold text-slate-900">{monthLabel(r.month)}</span> },
    { key: "openDeals", label: "Open deals", ...right, render: (r) => <span className="text-sm">{r.openDeals}</span> },
    { key: "openValue", label: "Open value", ...right, sortValueGetter: (r) => num(r.openValue), render: (r) => <span className="text-sm">{money(r.openValue, cur)}</span> },
    { key: "weightedValue", label: "Weighted", ...right, sortValueGetter: (r) => num(r.weightedValue), render: (r) => <span className="text-sm font-semibold text-slate-900">{money(r.weightedValue, cur)}</span> },
    {
      key: "wonValue",
      label: "Won",
      ...right,
      sortValueGetter: (r) => num(r.wonValue),
      render: (r) => (
        <span className="text-sm text-green-700">
          {money(r.wonValue, cur)}
          <span className="block text-xs text-slate-500">{count(r.wonDeals, "deal", "deals")}</span>
        </span>
      ),
    },
    { key: "lostDeals", label: "Lost", ...right, render: (r) => <span className="text-sm text-slate-700">{r.lostDeals}</span> },
  ];
  const exportColumns: ReportColumn<Row>[] = [
    { label: "Close month", value: (r) => (r.id === "totals" ? t("Total") : r.month ?? "") },
    { label: "Open deals", value: (r) => r.openDeals, format: "number" },
    { label: "Open value", value: (r) => num(r.openValue), format: "money" },
    { label: "Weighted", value: (r) => num(r.weightedValue), format: "money" },
    { label: "Won deals", value: (r) => r.wonDeals, format: "number" },
    { label: "Won", value: (r) => num(r.wonValue), format: "money" },
    { label: "Lost", value: (r) => r.lostDeals, format: "number" },
  ];
  const totals = report ? ({ ...report.totals, id: "totals" } as Row) : undefined;
  const details = owner ? [{ label: "Owner", value: owners.find((o) => o.value === owner)?.label ?? owner }] : [];

  return (
    <>
      <PageMeta title={t("Sales Forecast")} description="Open deals by expected close month" />
      <PageBreadcrumb pageTitle="Sales Forecast" />
      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Sales Forecast", period, columns: exportColumns, rows, totals, details }} />}>
          <PeriodPicker value={period} onChange={setPeriod} allowAll label="Close dates" />
          <SelectField label="Owner" value={owner} options={owners} allLabel="Everyone" onChange={setOwner} />
        </FilterBar>
        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Weighted" tone="cyan" value={money(report?.totals.weightedValue, cur)} hint={t("Each open deal × its probability")} />
          <TotalCard label="Open value" value={money(report?.totals.openValue, cur)} hint={count(report?.totals.openDeals, "deal", "deals")} />
          <TotalCard label="Won" tone="green" value={money(report?.totals.wonValue, cur)} hint={count(report?.totals.wonDeals, "deal", "deals")} />
          <TotalCard label="Close date passed" tone="red" value={money(report?.overdueValue, cur)} hint={count(report?.overdueDeals, "deal still open", "deals still open")} />
        </div>
        <BarList title="Weighted by close month" rows={chart} empty={loading ? "Loading…" : "No open deals close in this period"} />
        <Note text="Open deals by the month they are expected to close, and deals won or lost in each month. Weighted: each deal's amount × its probability. Deals without a close date aren't in the months; their total is below." />
        {report && report.noCloseDateDeals > 0 && (
          <p className="text-xs text-amber-700">{`${count(report.noCloseDateDeals, "open deal", "open deals")} ${t("without a close date")}: ${money(report.noCloseDateValue, cur)}`}</p>
        )}
        <ReusableTable data={rows} columns={columns} pageSize={25} loading={loading} defaultSortKey="month" defaultSortOrder="asc" emptyState={<Empty />} />
      </div>
    </>
  );
};

/* ================= By owner ================= */

interface OwnerRow {
  owner: string | null;
  ownerName: string | null;
  leads: number;
  convertedLeads: number;
  conversionPercent: number | null;
  dealsWon: number;
  wonValue: number;
  dealsLost: number;
  winRatePercent: number | null;
  openDeals: number;
  openValue: number;
  weightedValue: number;
}

export const CrmByOwner: React.FC = () => {
  const { period, setPeriod, report, loading } = useReport<{ currency: string | null; rows: OwnerRow[]; totals: OwnerRow; missingRates?: string[] }>(
    "by-owner",
    "this-quarter",
    false,
    "Failed to load the results by owner"
  );
  const cur = report?.currency;
  const rows = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.owner ?? UNASSIGNED })), [report]);
  type Row = (typeof rows)[number];
  const chart = rows.filter((r) => num(r.wonValue) > 0).slice(0, 10).map((r) => ({ key: r.id, label: ownerLabel(r.owner, r.ownerName), value: num(r.wonValue), display: `${money(r.wonValue, cur)} · ${count(r.dealsWon, "deal", "deals")}` }));
  const columns: ColumnDef<Row>[] = [
    { key: "ownerName", label: "Owner", sortable: true, render: (r) => <span className={`text-sm ${r.owner ? "font-semibold text-slate-900" : "italic text-slate-500"}`}>{ownerLabel(r.owner, r.ownerName)}</span> },
    { key: "leads", label: "Leads", ...right, render: (r) => <span className="text-sm">{r.leads}</span> },
    {
      key: "conversionPercent",
      label: "Conversion",
      ...right,
      sortValueGetter: (r) => num(r.conversionPercent ?? -1),
      render: (r) => (
        <span className="text-sm">
          {pct(r.conversionPercent)}
          <span className="block text-xs text-slate-500">{count(r.convertedLeads, "converted", "converted")}</span>
        </span>
      ),
    },
    { key: "dealsWon", label: "Deals won", ...right, render: (r) => <span className="text-sm">{r.dealsWon}</span> },
    { key: "wonValue", label: "Won value", ...right, sortValueGetter: (r) => num(r.wonValue), render: (r) => <span className="text-sm font-semibold text-green-700">{money(r.wonValue, cur)}</span> },
    {
      key: "winRatePercent",
      label: "Win rate",
      ...right,
      sortValueGetter: (r) => num(r.winRatePercent ?? -1),
      render: (r) => (
        <span className="text-sm">
          {pct(r.winRatePercent)}
          <span className="block text-xs text-slate-500">{count(r.dealsLost, "lost", "lost")}</span>
        </span>
      ),
    },
    {
      key: "weightedValue",
      label: "Open pipeline",
      ...right,
      sortValueGetter: (r) => num(r.openValue),
      render: (r) => (
        <span className="text-sm">
          {money(r.openValue, cur)}
          <span className="block text-xs text-slate-500">{`${t("Weighted")} ${money(r.weightedValue, cur)}`}</span>
        </span>
      ),
    },
  ];
  const exportColumns: ReportColumn<Row>[] = [
    { label: "Owner", value: (r) => (r.id === "totals" ? t("Total") : ownerLabel(r.owner, r.ownerName)) },
    { label: "Leads", value: (r) => r.leads, format: "number" },
    { label: "Converted", value: (r) => r.convertedLeads, format: "number" },
    { label: "Conversion", value: (r) => (r.conversionPercent == null ? "" : num(r.conversionPercent)), format: "percent" },
    { label: "Deals won", value: (r) => r.dealsWon, format: "number" },
    { label: "Won value", value: (r) => num(r.wonValue), format: "money" },
    { label: "Deals lost", value: (r) => r.dealsLost, format: "number" },
    { label: "Win rate", value: (r) => (r.winRatePercent == null ? "" : num(r.winRatePercent)), format: "percent" },
    { label: "Open deals", value: (r) => r.openDeals, format: "number" },
    { label: "Open value", value: (r) => num(r.openValue), format: "money" },
    { label: "Weighted", value: (r) => num(r.weightedValue), format: "money" },
  ];
  const totals = report ? ({ ...report.totals, id: "totals" } as Row) : undefined;

  return (
    <>
      <PageMeta title={t("Sales Team Performance")} description="Leads, conversion and deals won by owner" />
      <PageBreadcrumb pageTitle="Sales Team Performance" />
      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Sales Team Performance", period, columns: exportColumns, rows, totals }} />}>
          <PeriodPicker value={period} onChange={setPeriod} allowAll />
        </FilterBar>
        <ReportWarnings missingRates={report?.missingRates} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Won value" tone="green" value={money(report?.totals.wonValue, cur)} hint={count(report?.totals.dealsWon, "deal", "deals")} />
          <TotalCard label="Win rate" value={pct(report?.totals.winRatePercent)} hint={t("Won out of won and lost")} />
          <TotalCard label="Conversion" value={pct(report?.totals.conversionPercent)} hint={count(report?.totals.leads, "lead added", "leads added")} />
          <TotalCard label="Open pipeline" tone="cyan" value={money(report?.totals.openValue, cur)} hint={`${t("Weighted")} ${money(report?.totals.weightedValue, cur)}`} />
        </div>
        <BarList title="Won value by owner" rows={chart} empty={loading ? "Loading…" : "No deals won in this period"} />
        <Note text="Leads: added in the period, and how many of them are customers now. Deals won and lost: closed in the period. Open pipeline: every deal still open today, whatever the period." />
        <ReusableTable data={rows} columns={columns} pageSize={25} loading={loading} searchable searchFields={["ownerName", "owner"]} searchPlaceholder={t("Search owners")} defaultSortKey="wonValue" defaultSortOrder="desc" emptyState={<Empty />} />
      </div>
    </>
  );
};

/* ================= By lead source ================= */

interface SourceRow {
  source: string | null;
  leads: number;
  convertedLeads: number;
  conversionPercent: number | null;
  dealsWon: number;
  wonValue: number;
  lostLeads: number;
}

export const CrmBySource: React.FC = () => {
  const { period, setPeriod, owner, setOwner, report, loading } = useReport<{ currency: string | null; rows: SourceRow[]; totals: SourceRow; missingRates?: string[] }>(
    "by-source",
    "this-year",
    true,
    "Failed to load the results by lead source"
  );
  const owners = useOwnerOptions();
  const cur = report?.currency;
  const sourceLabel = (s?: string | null) => s || t("No source");
  const rows = useMemo(() => (report?.rows ?? []).map((r, i) => ({ ...r, id: r.source ?? `none-${i}` })), [report]);
  type Row = (typeof rows)[number];
  const chart = rows.slice(0, 10).map((r) => ({ key: r.id, label: sourceLabel(r.source), value: r.leads, display: `${count(r.leads, "lead", "leads")} · ${pct(r.conversionPercent)} · ${money(r.wonValue, cur)}` }));
  const columns: ColumnDef<Row>[] = [
    { key: "source", label: "Source", sortable: true, render: (r) => <span className={`text-sm ${r.source ? "font-semibold text-slate-900" : "italic text-slate-500"}`}>{sourceLabel(r.source)}</span> },
    { key: "leads", label: "Leads", ...right, render: (r) => <span className="text-sm">{r.leads}</span> },
    { key: "convertedLeads", label: "Converted", ...right, render: (r) => <span className="text-sm">{r.convertedLeads}</span> },
    { key: "conversionPercent", label: "Conversion", ...right, sortValueGetter: (r) => num(r.conversionPercent ?? -1), render: (r) => <span className="text-sm">{pct(r.conversionPercent)}</span> },
    { key: "lostLeads", label: "Lost", ...right, render: (r) => <span className="text-sm text-slate-700">{r.lostLeads}</span> },
    {
      key: "wonValue",
      label: "Won value",
      ...right,
      sortValueGetter: (r) => num(r.wonValue),
      render: (r) => (
        <span className="text-sm font-semibold text-green-700">
          {money(r.wonValue, cur)}
          <span className="block text-xs font-normal text-slate-500">{count(r.dealsWon, "deal", "deals")}</span>
        </span>
      ),
    },
  ];
  const exportColumns: ReportColumn<Row>[] = [
    { label: "Source", value: (r) => (r.id === "totals" ? t("Total") : sourceLabel(r.source)) },
    { label: "Leads", value: (r) => r.leads, format: "number" },
    { label: "Converted", value: (r) => r.convertedLeads, format: "number" },
    { label: "Conversion", value: (r) => (r.conversionPercent == null ? "" : num(r.conversionPercent)), format: "percent" },
    { label: "Lost", value: (r) => r.lostLeads, format: "number" },
    { label: "Deals won", value: (r) => r.dealsWon, format: "number" },
    { label: "Won value", value: (r) => num(r.wonValue), format: "money" },
  ];
  const totals = report ? ({ ...report.totals, id: "totals" } as Row) : undefined;
  const details = owner ? [{ label: "Owner", value: owners.find((o) => o.value === owner)?.label ?? owner }] : [];

  return (
    <>
      <PageMeta title={t("Lead Sources")} description="Leads, conversion and won value by where leads come from" />
      <PageBreadcrumb pageTitle="Lead Sources" />
      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Lead Sources", period, columns: exportColumns, rows, totals, details }} />}>
          <PeriodPicker value={period} onChange={setPeriod} allowAll label="Leads added" />
          <SelectField label="Owner" value={owner} options={owners} allLabel="Everyone" onChange={setOwner} />
        </FilterBar>
        <ReportWarnings missingRates={report?.missingRates} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Leads" value={String(report?.totals.leads ?? 0)} hint={t("Added in the period")} />
          <TotalCard label="Conversion" value={pct(report?.totals.conversionPercent)} hint={count(report?.totals.convertedLeads, "converted", "converted")} />
          <TotalCard label="Won value" tone="green" value={money(report?.totals.wonValue, cur)} hint={count(report?.totals.dealsWon, "deal", "deals")} />
          <TotalCard label="Lost" tone="red" value={String(report?.totals.lostLeads ?? 0)} hint={t("Leads marked Lost")} />
        </div>
        <BarList title="Leads by source" rows={chart} empty={loading ? "Loading…" : "No leads added in this period"} />
        <Note text="Leads added in the period by their source, how many became customers, and the deals won from them (on the lead, or on the customer it became), whenever they were won." />
        <ReusableTable data={rows} columns={columns} pageSize={25} loading={loading} defaultSortKey="leads" defaultSortOrder="desc" emptyState={<Empty />} />
      </div>
    </>
  );
};

/* ================= Win / loss reasons ================= */

interface ReasonRow {
  kind: "DEAL_WON" | "DEAL_LOST" | "LEAD_LOST";
  reason: string | null;
  count: number;
  value: number;
  sharePercent: number | null;
}
interface WinLoss {
  currency: string | null;
  dealsWon: number;
  wonValue: number;
  dealsLost: number;
  lostValue: number;
  winRatePercent: number | null;
  leadsLost: number;
  rows: ReasonRow[];
  missingRates?: string[];
}
const KIND_LABEL: Record<ReasonRow["kind"], string> = { DEAL_WON: "Deals won", DEAL_LOST: "Deals lost", LEAD_LOST: "Leads lost" };

export const CrmWinLoss: React.FC = () => {
  const { period, setPeriod, owner, setOwner, report, loading } = useReport<WinLoss>("win-loss", "this-quarter", true, "Failed to load the win and loss reasons");
  const owners = useOwnerOptions();
  const cur = report?.currency;
  const reasonLabel = (r: ReasonRow) => (r.kind === "DEAL_WON" ? t("Won") : r.reason || t("No reason given"));
  const rows = useMemo(() => (report?.rows ?? []).map((r, i) => ({ ...r, id: `${r.kind}-${r.reason ?? ""}-${i}` })), [report]);
  type Row = (typeof rows)[number];
  const chart = rows.filter((r) => r.kind === "DEAL_LOST").map((r) => ({ key: r.id, label: reasonLabel(r), value: r.count, display: `${count(r.count, "deal", "deals")} · ${pct(r.sharePercent)} · ${money(r.value, cur)}` }));
  const columns: ColumnDef<Row>[] = [
    { key: "kind", label: "What", sortable: true, render: (r) => <span className={`text-xs font-semibold ${r.kind === "DEAL_WON" ? "text-green-700" : "text-red-600"}`}>{t(KIND_LABEL[r.kind])}</span> },
    { key: "reason", label: "Reason", sortable: true, render: (r) => <span className={`text-sm ${r.reason || r.kind === "DEAL_WON" ? "text-slate-900" : "italic text-slate-500"}`}>{reasonLabel(r)}</span> },
    { key: "count", label: "Count", ...right, render: (r) => <span className="text-sm">{r.count}</span> },
    { key: "sharePercent", label: "Share", ...right, sortValueGetter: (r) => num(r.sharePercent), render: (r) => <span className="text-sm">{pct(r.sharePercent)}</span> },
    { key: "value", label: "Value", ...right, sortValueGetter: (r) => num(r.value), render: (r) => <span className="text-sm">{money(r.value, cur)}</span> },
  ];
  const exportColumns: ReportColumn<Row>[] = [
    { label: "What", value: (r) => t(KIND_LABEL[r.kind]) },
    { label: "Reason", value: (r) => reasonLabel(r) },
    { label: "Count", value: (r) => r.count, format: "number" },
    { label: "Share", value: (r) => (r.sharePercent == null ? "" : num(r.sharePercent)), format: "percent" },
    { label: "Value", value: (r) => num(r.value), format: "money" },
  ];
  const details = owner ? [{ label: "Owner", value: owners.find((o) => o.value === owner)?.label ?? owner }] : [];

  return (
    <>
      <PageMeta title={t("Win / Loss Reasons")} description="Why deals and leads are won and lost" />
      <PageBreadcrumb pageTitle="Win / Loss Reasons" />
      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Win / Loss Reasons", period, columns: exportColumns, rows, details }} />}>
          <PeriodPicker value={period} onChange={setPeriod} allowAll />
          <SelectField label="Owner" value={owner} options={owners} allLabel="Everyone" onChange={setOwner} />
        </FilterBar>
        <ReportWarnings missingRates={report?.missingRates} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Win rate" tone="cyan" value={pct(report?.winRatePercent)} hint={t("Won out of won and lost")} />
          <TotalCard label="Won" tone="green" value={money(report?.wonValue, cur)} hint={count(report?.dealsWon, "deal", "deals")} />
          <TotalCard label="Lost" tone="red" value={money(report?.lostValue, cur)} hint={count(report?.dealsLost, "deal", "deals")} />
          <TotalCard label="Leads lost" value={String(report?.leadsLost ?? 0)} hint={t("Marked Lost in the period")} />
        </div>
        <BarList title="Why deals were lost" rows={chart} empty={loading ? "Loading…" : "No deals lost in this period"} />
        <Note text="Deals won or lost in the period, and leads marked Lost in it, by the reason picked (CRM Settings → Lost reasons). Share: of the deals closed, or of the leads lost. A lead's value is its expected value." />
        <ReusableTable data={rows} columns={columns} pageSize={25} loading={loading} defaultSortKey="count" defaultSortOrder="desc" emptyState={<Empty />} />
      </div>
    </>
  );
};
