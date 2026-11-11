import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { BarChart3, CalendarCheck, Handshake, Percent, Target, TrendingUp, Trophy, UserPlus, Users } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  DashboardLayout, EmptyState, KpiCard, ModuleTiles, Panel, formatMoney, type DashboardTile,
} from "../Dashboard/dashboardKit";
import { formatDateTime } from "../../company/format";

import { t } from "../../i18n/i18n";
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

  const tiles: DashboardTile[] = [
    { name: "Customers", count: failed.includes("customers") ? null : customers, route: "/customer-management", icon: Users, tone: "blue" },
    { name: "Leads", count: failed.includes("leads") ? null : leads, route: "/leads", icon: UserPlus, tone: "emerald" },
    { name: "Opportunities", count: failed.includes("deals") ? null : deals.length, route: "/opportunities", icon: Handshake, tone: "amber" },
    { name: "Activities", count: failed.includes("activities") ? null : activities.length, route: "/activities", icon: CalendarCheck, tone: "purple" },
    { name: "CRM Reports", route: "/crm-reports", icon: BarChart3, tone: "teal" },
  ];

  return (
    <>
      <PageMeta title={t("CRM Dashboard")} description="Live overview of customers, leads, deals and activities" />
      <PageBreadcrumb pageTitle="CRM Dashboard" />

      <DashboardLayout
        failed={failed}
        links={<ModuleTiles tiles={tiles} loading={loading} />}
        panelClass="lg:grid-cols-3"
        kpis={
          <>
            <KpiCard label={t("Pipeline Value")} value={money(pipelineValue)} hint={t("{count} open deal(s)", { count: openDeals.length })}
              icon={Target} tone="cyan" loading={loading} />
            <KpiCard label={t("Won Value")} value={money(wonValue)} hint={t("{count} deal(s) won", { count: deals.filter((d) => d.stage === "WON").length })}
              icon={Trophy} tone="emerald" loading={loading} />
            <KpiCard label={t("Lead Conversion")} value={`${(report.leadConversionRate ?? 0).toFixed(1)}%`} hint={t("{count} lead(s) in total", { count: leads })}
              icon={Percent} tone="indigo" loading={loading} />
            <KpiCard label={t("Pending Activities")} value={pendingActivities.length} hint={t("Not completed or cancelled")}
              icon={CalendarCheck} tone="orange" loading={loading} />
          </>
        }
      >
        <Panel title={t("Deal pipeline by stage")} subtitle={t("Deals in each stage")} icon={Handshake} iconClass="text-amber-500">
          {stages.length === 0 ? (
            <EmptyState loading={loading}>{t("No deals yet.")}</EmptyState>
          ) : (
            <ul className="space-y-3">
              {stages.map((s) => (
                <li key={s.stage}>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>{s.stage.charAt(0) + s.stage.slice(1).toLowerCase()}</span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-gray-100 dark:bg-gray-800">
                    <div className="h-2 rounded bg-[rgb(var(--brand-600,0_151_167))]" style={{ width: `${s.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("New leads per month")} subtitle={t("Leads created each month")} icon={TrendingUp} iconClass="text-emerald-500">
          {monthly.length === 0 ? (
            <EmptyState loading={loading}>{t("No leads yet.")}</EmptyState>
          ) : (
            <div className="dash-chart flex h-[240px] items-end gap-2">
              {monthly.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end" title={`${m.month}: ${m.count}`}>
                  <span className="mb-1 text-[10px] text-gray-500">{m.count}</span>
                  <div className="w-full rounded-t bg-[rgb(var(--brand-300,77_208_225))]" style={{ height: `${Math.max(m.pct, 2)}%` }} />
                  <span className="mt-1 truncate text-[10px] text-gray-500">{m.month.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t("Upcoming activities")} subtitle={t("Earliest first")} icon={CalendarCheck} iconClass="text-purple-500" bodyClass="px-4 py-1">
          {upcoming.length === 0 ? (
            <EmptyState loading={loading}>{t("Nothing pending.")}</EmptyState>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link to="/activities" className="block py-2 hover:text-cyan-700">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{a.title || "Untitled"}</p>
                    <p className="truncate text-xs text-gray-500">
                      {a.scheduledTime ? formatDateTime(a.scheduledTime) : "No date"}
                      {a.assignedTo ? ` · ${a.assignedTo}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </DashboardLayout>
    </>
  );
}