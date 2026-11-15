import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, Clock, ListChecks, RefreshCw } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { MODULE_LABELS } from "../../access/access";
import { errorText } from "../../access/accessApi";
import { formatDateTime } from "../../company/format";
import { CompanyHealth, monitoringApi, waitedFor } from "../../monitoring/monitoringApi";
import { CARD, CARD_TITLE, PAGE_BODY, SECONDARY_BUTTON, STATS_ROW } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const REFRESH_MS = 60_000;

// Where each kind of waiting item is dealt with, so the administrator can go straight there
const WHERE: Record<string, { path: string; page: string }> = {
  pos_invoices_pending: { path: "/sales-pos", page: "Point of Sale" },
  pos_returns_pending: { path: "/sales-pos", page: "Point of Sale" },
  pos_cash_differences_unposted: { path: "/sales-pos", page: "Point of Sale" },
  pos_shifts_open: { path: "/sales-pos", page: "Point of Sale" },
  store_orders_needing_attention: { path: "/sales-online-stores", page: "Online Stores" },
  stores_failing: { path: "/sales-online-stores", page: "Online Stores" },
  sales_orders_awaiting_dispatch: { path: "/sales-orders", page: "Sales Orders" },
  purchase_orders_awaiting_approval: { path: "/purchase-service/orders", page: "Purchase Orders" },
  grns_awaiting_stock: { path: "/purchase-service/goods-receipt-notes", page: "Goods Receipts (GRN)" },
  vendor_payments_pending: { path: "/vendorPayments", page: "Vendor Payments" },
  pdc_due: { path: "/cheques", page: "Cheques" },
  webhooks_pending: { path: "/webhooks", page: "Webhooks" },
  webhooks_failed: { path: "/webhooks", page: "Webhooks" },
};

/**
 * Settings → System health (company administrators): is anything stuck in this company right now, are there alerts
 * about it, and how much business went through in the last day. Only this company's figures (the server filters
 * them); nothing here comes from other companies. Refreshes every minute.
 */
export default function SystemHealthPage() {
  const [data, setData] = useState<CompanyHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await monitoringApi.company());
      setError(null);
    } catch (err) {
      setError(errorText(err, "System health could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const problems = (data?.waiting ?? []).filter((w) => w.problem);
  const work = (data?.waiting ?? []).filter((w) => !w.problem);
  const steps = (data?.activity ?? []).reduce((sum, a) => sum + a.steps, 0);
  const allClear = data?.available && problems.length === 0 && data.alerts.length === 0;

  const row = (w: CompanyHealth["waiting"][number]) => {
    const where = WHERE[w.what];
    return (
      <li key={w.what} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
        <span className="text-slate-700 dark:text-gray-200">
          <span className="font-semibold">{w.count}</span> · {t(w.label)}
          {w.oldestSeconds != null && <span className="ms-1.5 text-slate-500 dark:text-gray-400">({t("oldest")} {waitedFor(w.oldestSeconds)})</span>}
        </span>
        {where && <Link to={where.path} className="text-cyan-700 hover:underline dark:text-cyan-300">{t(where.page)} →</Link>}
      </li>
    );
  };

  return (
    <>
      <PageMeta title={t("System health")} description="What is stuck or needs attention in your company" />
      <PageBreadcrumb
        pageTitle="System health"
        actions={
          <button type="button" className={`${SECONDARY_BUTTON} inline-flex items-center gap-1.5`} onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{t("Refresh")}
          </button>
        }
      />

      <div className={PAGE_BODY}>
        {(error || (data && !data.available)) && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(error ?? data?.message ?? "")}</span>
          </div>
        )}

        {allClear && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />{t("All clear: nothing is stuck and there are no alerts about your company.")}
          </div>
        )}

        <div className={STATS_ROW}>
          <StatsCard label={t("Needs a look")} value={problems.reduce((s, w) => s + w.count, 0)} gradient="from-rose-50 to-red-50"
            borderColor="border-rose-100" labelColor="text-rose-600" icon={<AlertTriangle />} loading={loading && !data} />
          <StatsCard label={t("Alerts")} value={data?.alerts.length ?? 0} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100"
            labelColor="text-amber-600" icon={<Clock />} loading={loading && !data} />
          <StatsCard label={t("Work in progress")} value={work.reduce((s, w) => s + w.count, 0)} gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<ListChecks />} loading={loading && !data} />
          <StatsCard label={t("Business steps, last 24 h")} value={steps} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"
            labelColor="text-green-600" icon={<CheckCircle2 />} loading={loading && !data} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={`${CARD} p-4`}>
            <h3 className={`${CARD_TITLE} mb-1`}>{t("Needs a look")}</h3>
            <p className="mb-2 text-[11px] text-slate-500 dark:text-gray-400">{t("Things that should have gone through by now. Open the page to finish or retry them.")}</p>
            {problems.length === 0 ? (
              <p className="py-3 text-center text-xs text-emerald-700 dark:text-emerald-300">{t("Nothing is stuck.")}</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-800">{problems.map(row)}</ul>
            )}
            {(data?.alerts.length ?? 0) > 0 && (
              <>
                <h4 className="mb-1 mt-4 text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Alerts about your company")}</h4>
                <ul className="space-y-1.5">
                  {data!.alerts.map((a, i) => (
                    <li key={`${a.name}-${i}`} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                      {a.summary ?? a.name}
                      {a.description && <span className="mt-0.5 block text-[11px] opacity-80">{a.description}</span>}
                      {a.since && <span className="mt-0.5 block text-[10px] opacity-70">{t("Since")} {formatDateTime(a.since)}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className={`${CARD} p-4`}>
            <h3 className={`${CARD_TITLE} mb-1`}>{t("Work in progress")}</h3>
            <p className="mb-2 text-[11px] text-slate-500 dark:text-gray-400">{t("Normal work waiting for someone: not a problem unless it piles up.")}</p>
            {work.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">{t("Nothing waiting.")}</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-gray-800">{work.map(row)}</ul>
            )}

            <h4 className="mb-1 mt-4 text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Business steps, last 24 h")}</h4>
            {(data?.activity ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">{t("No business steps recorded in the last 24 hours.")}</p>
            ) : (
              <ul className="space-y-1">
                {data!.activity.map((a) => {
                  const share = steps ? Math.round((a.steps / steps) * 100) : 0;
                  return (
                    <li key={a.module} className="text-xs">
                      <div className="flex justify-between text-slate-700 dark:text-gray-200">
                        <span>{t(MODULE_LABELS[a.module as keyof typeof MODULE_LABELS] ?? a.module)}</span>
                        <span>{a.steps}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 rounded-full bg-slate-100 dark:bg-gray-800">
                        <div className="h-1.5 rounded-full bg-cyan-400" style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[10px] text-slate-400">{t("Live figures, approximate; Report Center has the exact ones.")}</p>
          </div>
        </div>

        {data && <p className="mt-3 text-[11px] text-slate-400">{t("Checked")} {formatDateTime(data.checkedAt)} · {t("refreshes every minute")}</p>}
      </div>
    </>
  );
}
