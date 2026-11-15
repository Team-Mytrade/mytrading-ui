import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BookOpen, Building2, ExternalLink, LayoutDashboard, RefreshCw, Server } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { errorText } from "../../access/accessApi";
import { formatDateTime } from "../../company/format";
import { PlatformHealth, grafanaLink, monitoringApi, waitedFor } from "../../monitoring/monitoringApi";
import { CARD, CARD_TITLE, PAGE_BODY, SECONDARY_BUTTON, STATS_ROW } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const TH = "px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-xs text-slate-700 dark:text-gray-200";
const REFRESH_MS = 60_000;

const severityPill = (severity: string | null) =>
  severity === "critical"
    ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";

/**
 * Platform → Monitoring (Super Admin): is MyTrade healthy right now — services up, alerts firing, companies with
 * something stuck — and the way into Grafana's dashboards for the rest. Refreshes every minute.
 */
export default function MonitoringPage() {
  const [data, setData] = useState<PlatformHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await monitoringApi.platform());
      setError(null);
    } catch (err) {
      setError(errorText(err, "Monitoring could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const grafana = data?.grafanaUrl ?? null;
  const names = useMemo(() => new Map((data?.companies ?? []).map((c) => [c.tenantId, c.tenantName ?? c.tenantId])), [data]);
  const down = (data?.services ?? []).filter((s) => !s.up);
  const critical = (data?.alerts ?? []).filter((a) => a.severity === "critical").length;

  const companyHealth = (tenantId: string) => (grafana ? grafanaLink(grafana, "mt-company-health", { tenant: tenantId }) : null);

  return (
    <>
      <PageMeta title={t("Monitoring")} description="Platform health and the way into Grafana" />
      <PageBreadcrumb
        pageTitle="Monitoring"
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className={`${SECONDARY_BUTTON} inline-flex items-center gap-1.5`} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{t("Refresh")}
            </button>
            {grafana && (
              <a href={grafana} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400 bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-950 hover:bg-cyan-400">
                <ExternalLink className="h-3.5 w-3.5" />{t("Open Grafana")}
              </a>
            )}
          </div>
        }
      />

      <div className={PAGE_BODY}>
        {(error || (data && !data.available)) && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error ?? data?.message}</span>
          </div>
        )}

        <div className={STATS_ROW}>
          <StatsCard label={t("Services up")} value={data ? `${data.services.length - down.length} / ${data.services.length}` : "–"}
            gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<Server />} loading={loading && !data} />
          <StatsCard label={t("Alerts firing")} value={data?.alerts.length ?? 0} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100"
            labelColor="text-amber-600" icon={<AlertTriangle />} loading={loading && !data} />
          <StatsCard label={t("Critical")} value={critical} gradient="from-rose-50 to-red-50" borderColor="border-rose-100" labelColor="text-rose-600"
            icon={<Activity />} loading={loading && !data} />
          <StatsCard label={t("Companies with something stuck")} value={data?.companies.length ?? 0} gradient="from-purple-50 to-indigo-50"
            borderColor="border-purple-100" labelColor="text-purple-600" icon={<Building2 />} loading={loading && !data} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className={`${CARD} p-4`}>
            <h3 className={`${CARD_TITLE} mb-3`}>{t("Alerts firing now")}</h3>
            {data && data.alerts.length === 0 ? (
              <p className="py-4 text-center text-xs text-emerald-700 dark:text-emerald-300">{t("Nothing is firing.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-700">
                      <th className={TH}>{t("Alert")}</th>
                      <th className={TH}>{t("What")}</th>
                      <th className={TH}>{t("Company")}</th>
                      <th className={TH}>{t("Since")}</th>
                      <th className={TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.alerts ?? []).map((a, i) => (
                      <tr key={`${a.name}-${a.tenant}-${a.service}-${i}`} className="border-b border-slate-100 last:border-0 dark:border-gray-800">
                        <td className={TD}>
                          <span className={`me-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${severityPill(a.severity)}`}>
                            {t(a.severity === "critical" ? "Critical" : "Warning")}
                          </span>
                          <span className="font-medium">{a.name}</span>
                        </td>
                        <td className={TD}>{a.summary}</td>
                        <td className={TD}>{a.tenant ? names.get(a.tenant) ?? a.tenant : <span className="text-slate-400">{t("All")}</span>}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDateTime(a.since)}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {a.runbookUrl && (
                            <a href={a.runbookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-300">
                              <BookOpen className="h-3.5 w-3.5" />{t("Runbook")}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={`${CARD} p-4`}>
            <h3 className={`${CARD_TITLE} mb-3`}>{t("Services")}</h3>
            {data && data.services.length === 0 ? (
              <p className="text-xs text-slate-400">{t("No service reports to Prometheus yet.")}</p>
            ) : (
              <ul className="space-y-1">
                {(data?.services ?? []).map((s) => (
                  <li key={s.service} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 dark:text-gray-200">{s.service.replace(/^mytrade-/, "")}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.up ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"}`}>
                      {t(s.up ? "Up" : "Down")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={`${CARD} mt-4 p-4`}>
          <h3 className={`${CARD_TITLE} mb-1`}>{t("Companies with something stuck")}</h3>
          <p className="mb-3 text-[11px] text-slate-500 dark:text-gray-400">{t("Counter sales without invoice, store orders, e-invoices, stock postings… waiting now, the longest wait first.")}</p>
          {data && data.companies.length === 0 ? (
            <p className="py-3 text-center text-xs text-emerald-700 dark:text-emerald-300">{t("Nothing is stuck at any company.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-700">
                    <th className={TH}>{t("Company")}</th>
                    <th className={TH}>{t("Waiting")}</th>
                    <th className={TH}>{t("Oldest waits")}</th>
                    <th className={TH}>{t("Alerts")}</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {(data?.companies ?? []).map((c) => (
                    <tr key={c.tenantId} className="border-b border-slate-100 last:border-0 dark:border-gray-800">
                      <td className={TD}>
                        <span className="font-medium">{c.tenantName ?? c.tenantId}</span>
                        {c.tenantName && <span className="ms-1.5 text-[10px] text-slate-400">{c.tenantId}</span>}
                      </td>
                      <td className={TD}>{c.waiting}</td>
                      <td className={TD}>{waitedFor(c.oldestSeconds)}</td>
                      <td className={TD}>{c.alerts || ""}</td>
                      <td className={`${TD} text-end`}>
                        {companyHealth(c.tenantId) && (
                          <a href={companyHealth(c.tenantId)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-300">
                            <Activity className="h-3.5 w-3.5" />{t("Company health")}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`${CARD} mt-4 p-4`}>
          <h3 className={`${CARD_TITLE} mb-1`}>{t("Dashboards")}</h3>
          <p className="mb-3 text-[11px] text-slate-500 dark:text-gray-400">
            {grafana
              ? t("Open in Grafana (a new tab; Grafana has its own sign-in).")
              : t("Grafana's address isn't set: give user-service GRAFANA_URL (e.g. https://<host>/grafana) to open dashboards from here.")}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.dashboards ?? []).map((d) => {
              const body = (
                <>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-gray-100">
                    <LayoutDashboard className="h-3.5 w-3.5 text-cyan-600" />{t(d.title)}
                    {grafana && <ExternalLink className="ms-auto h-3 w-3 text-slate-400" />}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-gray-400">{t(d.description)}</span>
                </>
              );
              const box = "block rounded-lg border border-slate-200 px-3 py-2 dark:border-gray-700";
              return grafana ? (
                <a key={d.uid} href={grafanaLink(grafana, d.uid)} target="_blank" rel="noreferrer" className={`${box} hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20`}>{body}</a>
              ) : (
                <div key={d.uid} className={`${box} opacity-70`}>{body}</div>
              );
            })}
          </div>
        </div>

        {data && <p className="mt-3 text-[11px] text-slate-400">{t("Checked")} {formatDateTime(data.checkedAt)} · {t("refreshes every minute")}</p>}
      </div>
    </>
  );
}
