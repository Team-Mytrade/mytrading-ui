import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  UserGroupIcon,
  BriefcaseIcon,
  UsersIcon,
  TagIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReportSummary {
  totalLeads?: number;
  qualifiedLeads?: number;
  convertedLeads?: number;
  lostLeads?: number;

  totalDeals?: number;
  openDeals?: number;
  wonDeals?: number;
  lostDeals?: number;
  pipelineValue?: number;
  wonValue?: number;
  averageDealSize?: number;

  totalCustomers?: number;
  activeCustomers?: number;
  newCustomersThisMonth?: number;

  totalSegments?: number;
  activeSegments?: number;

  totalActivities?: number;
  pendingActivities?: number;
  completedActivities?: number;
  overdueActivities?: number;

  totalCommunications?: number;
  communicationsByType?: Record<string, number>;

  dealsByStage?: Record<string, number>;
  leadsByStatus?: Record<string, number>;
  activitiesByType?: Record<string, number>;

  conversionRate?: number;
  winRate?: number;
  averageSalesCycleDays?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/crm/reports";
const getToken = () => localStorage.getItem("accessToken") || "";

const safeNumber = (v: unknown, fallback = 0): number =>
  typeof v === "number" && !isNaN(v) ? v : fallback;

const formatCurrency = (amount: number) => {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount}`;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const titleCase = (s: string) =>
  s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const pickNumber = (obj: Record<string, unknown>, keys: string[]): number => {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && !isNaN(Number(v))) return Number(v);
  }
  return 0;
};

const pickRecord = (
  obj: Record<string, unknown>,
  keys: string[]
): Record<string, number> => {
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, number> = {};
      for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
        if (typeof val === "number") out[key] = val;
      }
      if (Object.keys(out).length) return out;
    }
  }
  return {};
};

const normalizeReport = (raw: unknown): ReportSummary => {
  if (!raw || typeof raw !== "object") return {};
  let src = raw as Record<string, unknown>;

  for (const key of ["data", "summary", "content", "report"]) {
    if (src[key] && typeof src[key] === "object") {
      src = src[key] as Record<string, unknown>;
      break;
    }
  }

  return {
    totalLeads: pickNumber(src, ["totalLeads", "leadCount", "leads"]),
    qualifiedLeads: pickNumber(src, ["qualifiedLeads"]),
    convertedLeads: pickNumber(src, ["convertedLeads", "wonLeads"]),
    lostLeads: pickNumber(src, ["lostLeads"]),

    totalDeals: pickNumber(src, ["totalDeals", "dealCount", "deals"]),
    openDeals: pickNumber(src, ["openDeals", "activeDeals"]),
    wonDeals: pickNumber(src, ["wonDeals", "closedWon"]),
    lostDeals: pickNumber(src, ["lostDeals", "closedLost"]),
    pipelineValue: pickNumber(src, ["pipelineValue", "openValue"]),
    wonValue: pickNumber(src, ["wonValue", "revenue"]),
    averageDealSize: pickNumber(src, ["averageDealSize", "avgDealSize"]),

    totalCustomers: pickNumber(src, [
      "totalCustomers",
      "customerCount",
      "customers",
    ]),
    activeCustomers: pickNumber(src, ["activeCustomers"]),
    newCustomersThisMonth: pickNumber(src, ["newCustomersThisMonth"]),

    totalSegments: pickNumber(src, ["totalSegments", "segmentCount"]),
    activeSegments: pickNumber(src, ["activeSegments"]),

    totalActivities: pickNumber(src, ["totalActivities", "activityCount"]),
    pendingActivities: pickNumber(src, ["pendingActivities"]),
    completedActivities: pickNumber(src, ["completedActivities"]),
    overdueActivities: pickNumber(src, ["overdueActivities"]),

    totalCommunications: pickNumber(src, [
      "totalCommunications",
      "communicationCount",
    ]),
    communicationsByType: pickRecord(src, [
      "communicationsByType",
      "byCommunicationType",
    ]),

    dealsByStage: pickRecord(src, [
      "dealsByStage",
      "byDealStage",
      "stageBreakdown",
    ]),
    leadsByStatus: pickRecord(src, [
      "leadsByStatus",
      "byLeadStatus",
      "statusBreakdown",
    ]),
    activitiesByType: pickRecord(src, [
      "activitiesByType",
      "byActivityType",
    ]),

    conversionRate: pickNumber(src, ["conversionRate", "leadConversionRate"]),
    winRate: pickNumber(src, ["winRate", "dealWinRate"]),
    averageSalesCycleDays: pickNumber(src, [
      "averageSalesCycleDays",
      "avgSalesCycle",
    ]),
  };
};

/* ------------------------------------------------------------------ */
/*  Colors                                                             */
/* ------------------------------------------------------------------ */

const stageColor = (stage: string): string => {
  switch (stage.toUpperCase()) {
    case "PROSPECTING":
      return "bg-blue-500";
    case "NEGOTIATION":
      return "bg-yellow-500";
    case "CLOSED_WON":
      return "bg-green-500";
    case "CLOSED_LOST":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
};

const leadStatusColor = (status: string): string => {
  switch (status.toUpperCase()) {
    case "NEW":
      return "bg-blue-500";
    case "CONTACTED":
      return "bg-yellow-500";
    case "QUALIFIED":
      return "bg-green-500";
    case "LOST":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
};

const activityTypeColor = (type: string): string => {
  switch (type.toUpperCase()) {
    case "CALL":
      return "bg-blue-500";
    case "MEETING":
      return "bg-purple-500";
    case "EMAIL":
      return "bg-green-500";
    default:
      return "bg-slate-400";
  }
};

/* ------------------------------------------------------------------ */
/*  Compact subcomponents                                              */
/* ------------------------------------------------------------------ */

const KpiTile: React.FC<{
  label: string;
  value: string | number;
  accent?: string;
}> = ({ label, value, accent = "text-slate-900" }) => (
  <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 truncate">
      {label}
    </span>
    <span className={`text-lg font-bold truncate ${accent}`}>{value}</span>
  </div>
);

const CompactBarList: React.FC<{
  title: string;
  data: Record<string, number>;
  colorFn?: (key: string) => string;
}> = ({ title, data, colorFn }) => {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  return (
    <div className="flex flex-col min-h-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h4 className="text-xs font-semibold text-slate-900 mb-2 shrink-0">
        {title}
      </h4>
      {entries.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No data available</p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {entries
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([key, value]) => {
              const pct = (value / max) * 100;
              const color = colorFn?.(key) || "bg-cyan-500";
              return (
                <div
                  key={key}
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: "80px 1fr 28px" }}
                >
                  <span
                    className="text-[10px] text-slate-600 truncate"
                    title={titleCase(key)}
                  >
                    {titleCase(key)}
                  </span>
                  <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-900 text-right">
                    {value}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

const CompactModule: React.FC<{
  icon: React.ReactNode;
  title: string;
  rows: [string, number][];
  loading: boolean;
}> = ({ icon, title, rows, loading }) => (
  <div className="flex flex-col min-h-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
      {icon}
      <h4 className="text-xs font-semibold text-slate-900 truncate">
        {title}
      </h4>
    </div>
    <div className="flex flex-col gap-0.5 min-h-0">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between text-[11px]"
        >
          <span className="text-slate-500 truncate">{label}</span>
          <span className="font-semibold text-slate-900">
            {loading ? "—" : value}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const TrendTile: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  accentClass: string;
  title: string;
  value: string | number;
  subtitle: string;
}> = ({ icon, iconClass, accentClass, title, value, subtitle }) => (
  <div
    className={`flex flex-col justify-center rounded-lg border border-slate-200 border-l-4 bg-white px-3 py-2 shadow-sm ${accentClass}`}
  >
    <div className={`flex items-center gap-1.5 ${iconClass}`}>
      {icon}
      <span className="text-[11px] font-semibold truncate">{title}</span>
    </div>
    <p className="text-lg font-bold text-slate-900 truncate">{value}</p>
    <p className="text-[10px] text-slate-500 truncate">{subtitle}</p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const Reports: React.FC = () => {
  const [report, setReport] = useState<ReportSummary>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${getToken()}` }),
    []
  );

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_URL, {
        headers: authHeaders,
        validateStatus: (status) => status < 500,
      });

      if (res.status === 403) {
        ToasterService.error(
          res.data?.error || "You don't have permission to view reports"
        );
        setReport({});
        return;
      }
      if (res.status >= 400) {
        ToasterService.error(
          res.data?.message || res.data?.error || "Failed to load report data"
        );
        setReport({});
        return;
      }

      setReport(normalizeReport(res.data));
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("Error fetching report:", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to load report data"
      );
      setReport({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (type: "pdf" | "excel") => {
    const endpoint =
      type === "pdf"
        ? "/v1/api/crm/reports/export/pdf"
        : "/v1/api/crm/reports/export/excel";
    const filename =
      type === "pdf"
        ? `crm-report-${Date.now()}.pdf`
        : `crm-report-${Date.now()}.xlsx`;

    try {
      setExporting(type);
      const res = await axios.get(endpoint, {
        headers: authHeaders,
        responseType: "blob",
      });
      downloadBlob(res.data, filename);
      ToasterService.success(
        `${type === "pdf" ? "PDF" : "Excel"} report downloaded`
      );
    } catch (err: any) {
      console.error(`Error exporting ${type}:`, err);
      ToasterService.error(
        err.response?.data?.message || `Failed to export ${type}`
      );
    } finally {
      setExporting(null);
    }
  };

  const conversionRate = report.conversionRate
    ? report.conversionRate
    : report.totalLeads
    ? safeNumber(report.convertedLeads) / safeNumber(report.totalLeads) || 0
    : 0;

  const winRate = report.winRate
    ? report.winRate
    : report.totalDeals
    ? safeNumber(report.wonDeals) / safeNumber(report.totalDeals) || 0
    : 0;

  /* ---------------- Render ---------------- */

  return (
    <>
      <PageMeta
        title="CRM Reports"
        description="Analytics and performance overview"
      />

      <PageBreadcrumb
        pageTitle="Reports"
        className="crm-report-breadcrumb"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowPathIcon
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => handleExport("excel")}
              disabled={!!exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <DocumentArrowDownIcon className="h-3.5 w-3.5" />
              {exporting === "excel" ? "..." : "Excel"}
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:opacity-60"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              {exporting === "pdf" ? "..." : "PDF"}
            </button>
          </div>
        }
      />

      {/*
        Full-height layout. The parent page must give this ~100vh.
        We use `min-h-0` on grid children so they can shrink rather than
        push the page taller.
      */}
      <div className="crm-report-page w-full max-w-none px-0 sm:px-0 lg:px-0">
        <div
          className="flex flex-col gap-2 overflow-hidden"
          style={{
            // Reserve space for the header/breadcrumb above; adjust if your
            // layout chrome is a different height.
            height: "calc(100vh - 180px)",
          }}
        >
          {/* -------- Row 1: Primary KPIs + Trend tiles (one strip) -------- */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 shrink-0">
            <KpiTile
              label="Total Leads"
              value={loading ? "—" : safeNumber(report.totalLeads)}
            />
            <KpiTile
              label="Total Deals"
              value={loading ? "—" : safeNumber(report.totalDeals)}
            />
            <KpiTile
              label="Pipeline"
              value={
                loading ? "—" : formatCurrency(safeNumber(report.pipelineValue))
              }
              accent="text-cyan-700"
            />
            <KpiTile
              label="Won Value"
              value={
                loading ? "—" : formatCurrency(safeNumber(report.wonValue))
              }
              accent="text-green-700"
            />
            <KpiTile
              label="Conversion"
              value={loading ? "—" : formatPercent(conversionRate)}
            />
            <KpiTile
              label="Win Rate"
              value={loading ? "—" : formatPercent(winRate)}
            />
            <KpiTile
              label="Avg Deal"
              value={
                loading
                  ? "—"
                  : formatCurrency(safeNumber(report.averageDealSize))
              }
            />
            <KpiTile
              label="Customers"
              value={loading ? "—" : safeNumber(report.totalCustomers)}
            />
          </div>

          {/* -------- Row 2: Trend tiles -------- */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 shrink-0">
            <TrendTile
              icon={<ArrowTrendingUpIcon className="h-3.5 w-3.5" />}
              iconClass="text-green-700"
              accentClass="border-l-green-500"
              title="Won Deals"
              value={loading ? "—" : safeNumber(report.wonDeals)}
              subtitle={
                report.totalDeals
                  ? `${formatPercent(winRate)} win rate`
                  : "No deals yet"
              }
            />
            <TrendTile
              icon={<ChartBarIcon className="h-3.5 w-3.5" />}
              iconClass="text-amber-700"
              accentClass="border-l-amber-500"
              title="Open Deals"
              value={loading ? "—" : safeNumber(report.openDeals)}
              subtitle={
                report.averageSalesCycleDays
                  ? `Avg cycle: ${report.averageSalesCycleDays} days`
                  : "Cycle time unavailable"
              }
            />
            <TrendTile
              icon={<ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
              iconClass="text-red-600"
              accentClass="border-l-red-500"
              title="Lost Deals"
              value={loading ? "—" : safeNumber(report.lostDeals)}
              subtitle={
                report.totalDeals
                  ? `${formatPercent(1 - winRate)} of closed lost`
                  : "No deals yet"
              }
            />
          </div>

          {/* -------- Row 3: Charts (4 up, equal height, min-h-0) -------- */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 min-h-0 flex-1">
            <CompactBarList
              title="Deals by Stage"
              data={report.dealsByStage || {}}
              colorFn={stageColor}
            />
            <CompactBarList
              title="Leads by Status"
              data={report.leadsByStatus || {}}
              colorFn={leadStatusColor}
            />
            <CompactBarList
              title="Activities by Type"
              data={report.activitiesByType || {}}
              colorFn={activityTypeColor}
            />
            <CompactBarList
              title="Communications"
              data={report.communicationsByType || {}}
              colorFn={activityTypeColor}
            />
          </div>

          {/* -------- Row 4: Module summaries (6 up) -------- */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 shrink-0">
            <CompactModule
              icon={<UserGroupIcon className="h-3.5 w-3.5 text-blue-600" />}
              title="Leads"
              rows={[
                ["Total", safeNumber(report.totalLeads)],
                ["Qualified", safeNumber(report.qualifiedLeads)],
                ["Converted", safeNumber(report.convertedLeads)],
                ["Lost", safeNumber(report.lostLeads)],
              ]}
              loading={loading}
            />
            <CompactModule
              icon={<BriefcaseIcon className="h-3.5 w-3.5 text-amber-600" />}
              title="Deals"
              rows={[
                ["Total", safeNumber(report.totalDeals)],
                ["Open", safeNumber(report.openDeals)],
                ["Won", safeNumber(report.wonDeals)],
                ["Lost", safeNumber(report.lostDeals)],
              ]}
              loading={loading}
            />
            <CompactModule
              icon={<UsersIcon className="h-3.5 w-3.5 text-green-600" />}
              title="Customers"
              rows={[
                ["Total", safeNumber(report.totalCustomers)],
                ["Active", safeNumber(report.activeCustomers)],
                ["New (mo)", safeNumber(report.newCustomersThisMonth)],
              ]}
              loading={loading}
            />
            <CompactModule
              icon={<TagIcon className="h-3.5 w-3.5 text-cyan-600" />}
              title="Segments"
              rows={[
                ["Total", safeNumber(report.totalSegments)],
                ["Active", safeNumber(report.activeSegments)],
              ]}
              loading={loading}
            />
            <CompactModule
              icon={
                <CalendarDaysIcon className="h-3.5 w-3.5 text-purple-600" />
              }
              title="Activities"
              rows={[
                ["Total", safeNumber(report.totalActivities)],
                ["Pending", safeNumber(report.pendingActivities)],
                ["Done", safeNumber(report.completedActivities)],
                ["Overdue", safeNumber(report.overdueActivities)],
              ]}
              loading={loading}
            />
            <CompactModule
              icon={
                <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-indigo-600" />
              }
              title="Comms"
              rows={[["Total", safeNumber(report.totalCommunications)]]}
              loading={loading}
            />
          </div>

          {/* -------- Footer strip: updated + insight -------- */}
          <div className="flex items-center justify-between shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <TrophyIcon className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-[11px] text-slate-600 truncate">
                {loading
                  ? "Loading insights..."
                  : report.totalDeals
                  ? `${safeNumber(
                      report.openDeals
                    )} open deal(s) worth ${formatCurrency(
                      safeNumber(report.pipelineValue)
                    )} · Win rate ${formatPercent(winRate)}`
                  : "Add deals to see sales insights here."}
              </p>
            </div>
            {lastUpdated && (
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Reports;