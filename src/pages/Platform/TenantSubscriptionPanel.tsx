import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { CompanyPlan, SUBSCRIPTION_TONE, plansApi, subscriptionText } from "../../platform/plansApi";
import { formatDate, todayIso } from "../../company/format";
import { SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";

/**
 * A company's subscription period (Super Admin): start a trial or a monthly / yearly period, renew it when a
 * payment comes in, or remove the period (the plan then never expires). Each change is sent to the billing system.
 */
export default function TenantSubscriptionPanel({ tenantId, plan, onChanged }: {
  tenantId: string;
  plan: CompanyPlan;
  onChanged: (plan: CompanyPlan) => void;
}) {
  const s = plan.subscription;
  const [kind, setKind] = useState<"PERIOD" | "TRIAL" | "NONE">(s ? (s.trial ? "TRIAL" : "PERIOD") : "PERIOD");
  const [cycle, setCycle] = useState<string>(s?.billingCycle ?? "MONTHLY");
  const [start, setStart] = useState(todayIso());
  const [trialDays, setTrialDays] = useState("14");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<CompanyPlan>, done: string) => {
    setBusy(true);
    try {
      onChanged(await action());
      ToasterService.success(done);
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not change the subscription.")));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (kind === "TRIAL" && !(Number(trialDays) >= 1 && Number(trialDays) <= 365)) {
      ToasterService.error(t("A trial lasts 1 to 365 days."));
      return;
    }
    run(() => plansApi.setSubscription(tenantId, {
      billingCycle: kind === "NONE" ? null : cycle,
      periodStart: kind === "NONE" ? null : start,
      trialDays: kind === "TRIAL" ? Number(trialDays) : null,
    }), t("Subscription saved."));
  };

  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-gray-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Subscription")}</p>
        {s ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUBSCRIPTION_TONE[s.state]}`}>
            {t(subscriptionText(s, (d) => formatDate(d)))}
          </span>
        ) : <span className="text-[11px] text-slate-400">{t("No period: the plan never expires")}</span>}
      </div>
      {s && (
        <p className="mb-2 text-[11px] text-slate-500 dark:text-gray-400">
          {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}{s.billingCycle ? ` · ${t(s.billingCycle === "YEARLY" ? "Yearly" : "Monthly")}` : ""}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL} htmlFor="sub-kind">{t("Type")}</label>
          <select id="sub-kind" className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="PERIOD">{t("Paid period")}</option>
            <option value="TRIAL">{t("Free trial")}</option>
            <option value="NONE">{t("No period")}</option>
          </select>
        </div>
        {kind !== "NONE" && (
          <div>
            <label className={LABEL} htmlFor="sub-start">{t("Starts")}</label>
            <input id="sub-start" type="date" className={INPUT} value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        )}
        {kind === "TRIAL" ? (
          <div>
            <label className={LABEL} htmlFor="sub-trial">{t("Trial days")}</label>
            <input id="sub-trial" type="number" min={1} max={365} className={INPUT} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
          </div>
        ) : kind === "PERIOD" && (
          <div>
            <label className={LABEL} htmlFor="sub-cycle">{t("Billing")}</label>
            <select id="sub-cycle" className={INPUT} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              <option value="MONTHLY">{t("Monthly")}</option>
              <option value="YEARLY">{t("Yearly")}</option>
            </select>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {s && (
          <button type="button" className={SECONDARY_BUTTON} disabled={busy}
            onClick={() => run(() => plansApi.renew(tenantId, s.billingCycle ? undefined : cycle), t("Subscription renewed."))}>
            <RefreshCw className="h-4 w-4" /> {t("Renew one period")}
          </button>
        )}
        <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={save}>{t("Set subscription")}</button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">
        {t("When a period ends the company keeps working through the grace period, then it is suspended until renewed.")}
      </p>
    </div>
  );
}
