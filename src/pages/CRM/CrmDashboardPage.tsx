import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { DASH_CARD, DASH_TITLE, TONE_CYCLE, formatMoney, toneCard, toneLink } from "../Dashboard/dashboardKit";
import { formatDateTime } from "../../company/format";

// Live CRM overview. Every figure comes from the CRM service; nothing is hard-coded.

interface CrmReport {
  leadConversionRate?: number;
  opportunityStageBreakdown?: Record<string, number>;
  monthlyLeads?: Record<string, number>;
}

interface Deal {
  id: number;
  dealName?: string;
  amount?: number;
  stage?: string;
  status?: string;
}

interface Activity {
  id: number;
  title?: string;
  status?: string;
  scheduledTime?: string;
  assignedTo?: string;
}

const STAGE_ORDER = ["PROSPECTING", "QUALIFIED", "NEGOTIATION", "WON", "LOST"];

const listOf = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  const content = (data as { content?: unknown })?.content;
  return Array.isArray(content) ? (content as T[]) : [];
};

const money = (value: number) => formatMoney(value);

export default function CrmDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [report, setReport] = useState<CrmReport>({});
  const [customers, setCustomers] = useState(0);
  const [leads, setLeads] = useState(0);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const sources = [
      ["reports", axios.get("/v1/api/crm/reports")],
      ["customers", axios.get("/v1/api/common/customers")],
      ["leads", axios.get("/v1/api/crm/leads")],
      ["deals", axios.get("/v1/api/crm/deals")],
      ["activities", axios.get("/v1/api/crm/activities")],
    ] as const;
    Promise.allSettled(sources.map(([, request]) => request)).then((results) => {
      const errors: string[] = [];
      results.forEach((result, index) => {
        const name = sources[index][0];
        if (result.status === "rejected") {
          errors.push(name);
          return;
        }
        const data = result.value.data;
        if (name === "reports") setReport(data ?? {});
        if (name === "customers") setCustomers(listOf(data).length);
        if (name === "leads") setLeads(listOf(data).length);
        if (name === "deals") setDeals(listOf<Deal>(data));
        if (name === "activities") setActivities(listOf<Activity>(data));
      });
      setFailed(errors);
      setLoading(false);
    });
  }, []);

  // Same rule as the CRM report: open = not won, lost or cancelled
  const openDeals = deals.filter((d) => d.stage !== "WON" && d.stage !== "LOST" && d.status !== "CANCELLED");
  const pipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const wonValue = deals.filter((d) => d.stage === "WON").reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const pendingActivities = activities.filter((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED");

  const stages = useMemo(() => {
    const breakdown = report.opportunityStageBreakdown ?? {};
    const keys = [...STAGE_ORDER.filter((s) => s in breakdown), ...Object.keys(breakdown).filter((s) => !STAGE_ORDER.includes(s))];
    const max = Math.max(1, ...keys.map((k) => breakdown[k] ?? 0));
    return keys.map((k) => ({ stage: k, count: breakdown[k] ?? 0, pct: ((breakdown[k] ?? 0) / max) * 100 }));
  }, [report]);

  const monthly = useMemo(() => {
    const entries = Object.entries(report.monthlyLeads ?? {});
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries.map(([month, count]) => ({ month, count, pct: (count / max) * 100 }));
  }, [report]);

  const upcoming = [...pendingActivities]
    .sort((a, b) => String(a.scheduledTime ?? "").localeCompare(String(b.scheduledTime ?? "")))
    .slice(0, 6);

  const kpis = [
    { label: "Customers", value: customers, to: "/customer-management" },
    { label: "Leads", value: leads, to: "/leads" },
    { label: "Open deals", value: openDeals.length, to: "/opportunities" },
    { label: "Pipeline value", value: money(pipelineValue), to: "/opportunities" },
    { label: "Won value", value: money(wonValue), to: "/opportunities" },
    { label: "Lead conversion", value: `${(report.leadConversionRate ?? 0).toFixed(1)}%`, to: "/crm-reports" },
    { label: "Pending activities", value: pendingActivities.length, to: "/activities" },
  ];

  return (
    <div className="h-full overflow-y-auto px-1 pb-6 pt-1">
      <PageMeta title="CRM Dashboard" description="Live overview of customers, leads, deals and activities" />
      <PageBreadcrumb pageTitle="CRM Dashboard" />

      {failed.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Some figures could not be loaded ({failed.join(", ")}). They are shown as 0.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {kpis.map((kpi, i) => {
          // Tinted like the approval queue cards; each figure takes the next tone
          const tone = TONE_CYCLE[i % TONE_CYCLE.length];
          return (
            <Link key={kpi.label} to={kpi.to}
              className={`group flex flex-col justify-between space-y-1 p-3 ${toneCard(tone)}`}>
              <p className="text-xs font-bold text-gray-900 dark:text-white">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{loading ? "…" : kpi.value}</p>
              <span className={`flex items-center gap-1 text-[11px] font-bold transition-all group-hover:translate-x-0.5 ${toneLink(tone)}`}>
                Open <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className={`p-5 ${DASH_CARD}`}>
          <h2 className={`mb-3 ${DASH_TITLE}`}>Deal pipeline by stage</h2>
          {stages.length === 0 && <p className="text-sm text-gray-500">{loading ? "Loading…" : "No deals yet."}</p>}
          <ul className="space-y-2">
            {stages.map((s) => (
              <li key={s.stage}>
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                  <span>{s.stage.charAt(0) + s.stage.slice(1).toLowerCase()}</span>
                  <span>{s.count}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-gray-100 dark:bg-gray-800">
                  <div className="h-2 rounded bg-[#0097a7]" style={{ width: `${s.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={`p-5 ${DASH_CARD}`}>
          <h2 className={`mb-3 ${DASH_TITLE}`}>New leads per month</h2>
          {monthly.length === 0 && <p className="text-sm text-gray-500">{loading ? "Loading…" : "No leads yet."}</p>}
          <div className="flex h-40 items-end gap-2">
            {monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center justify-end" title={`${m.month}: ${m.count}`}>
                <span className="mb-1 text-[10px] text-gray-500">{m.count}</span>
                <div className="w-full rounded-t bg-[#4dd0e1]" style={{ height: `${Math.max(m.pct, 2)}%` }} />
                <span className="mt-1 truncate text-[10px] text-gray-500">{m.month.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`p-5 ${DASH_CARD}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={DASH_TITLE}>Upcoming activities</h2>
            <Link to="/activities" className="text-xs text-cyan-600 hover:underline">All</Link>
          </div>
          {upcoming.length === 0 && <p className="text-sm text-gray-500">{loading ? "Loading…" : "Nothing pending."}</p>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {upcoming.map((a) => (
              <li key={a.id} className="py-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{a.title || "Untitled"}</p>
                <p className="text-xs text-gray-500">
                  {a.scheduledTime ? formatDateTime(a.scheduledTime) : "No date"}
                  {a.assignedTo ? ` · ${a.assignedTo}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
