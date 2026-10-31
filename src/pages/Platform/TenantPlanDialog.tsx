import { useState } from "react";
import { X } from "lucide-react";
import { ToasterService } from "../../Services/ToasterService";
import { TenantAccess, errorText } from "../../access/accessApi";
import { CompanyPlan, Plan, limitText, planPrice, plansApi, storageText } from "../../platform/plansApi";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import TenantSubscriptionPanel from "./TenantSubscriptionPanel";

import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";

const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));
const field = (current: CompanyPlan | undefined, key: string, value: number | null) =>
  current?.overridden.includes(key) ? (value == null ? "" : String(value)) : "";

/**
 * A company's plan (Super Admin), and what was agreed differently for it: an empty box keeps the plan's value.
 * Its modules follow the plan; modules changed with "Edit" on the row are kept as agreed modules.
 */
export default function TenantPlanDialog({ tenant, plans, current, onClose, onSaved }: {
  tenant: TenantAccess;
  plans: Plan[];
  current?: CompanyPlan;
  onClose: () => void;
  onSaved: (plan: CompanyPlan) => void;
}) {
  const [planId, setPlanId] = useState<number | "">(current?.planId ?? "");
  const [maxUsers, setMaxUsers] = useState(field(current, "maxUsers", current?.maxUsers ?? null));
  const [maxStorage, setMaxStorage] = useState(field(current, "maxStorageMb", current?.maxStorageMb ?? null));
  const [monthly, setMonthly] = useState(field(current, "monthlyPrice", current?.monthlyPrice ?? null));
  const [yearly, setYearly] = useState(field(current, "yearlyPrice", current?.yearlyPrice ?? null));
  const [note, setNote] = useState(current?.note ?? "");
  const [keepModules, setKeepModules] = useState(!!current?.overridden.includes("modules"));
  const [saving, setSaving] = useState(false);
  const plan = plans.find((p) => p.id === planId);
  const choosable = plans.filter((p) => p.active || p.id === current?.planId);

  const save = async () => {
    if (!planId) {
      ToasterService.error(t("Choose the plan."));
      return;
    }
    setSaving(true);
    try {
      const saved = await plansApi.assign(tenant.tenantId, {
        planId,
        // Keep the agreed modules only when staying on the same plan
        modules: keepModules && current && current.planId === planId ? current.modules : null,
        maxUsers: numberOrNull(maxUsers), maxStorageMb: numberOrNull(maxStorage),
        monthlyPrice: numberOrNull(monthly), yearlyPrice: numberOrNull(yearly), note: note.trim() || null,
      });
      ToasterService.success(`${tenant.tenantName} ${t("is on plan")} ${saved.planName}.`);
      onSaved(saved);
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not change the plan.")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`${CARD} max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-5`} role="dialog" aria-labelledby="tenant-plan-title">
        <div className="flex items-center justify-between">
          <h3 id="tenant-plan-title" className="text-sm font-semibold text-slate-900 dark:text-white">{t("Plan of")} {tenant.tenantName}</h3>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div>
          <label className={LABEL} htmlFor="tenant-plan">{t("Plan")}</label>
          <select id="tenant-plan" className={INPUT} value={planId} onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">{t("Choose...")}</option>
            {choosable.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : ` (${t("inactive")})`}</option>)}
          </select>
          {plan && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">
              {t(limitText(plan.maxUsers, "users"))} · {t(storageText(plan.maxStorageMb))} · {planPrice(plan.monthlyPrice, plan.currency)} {t("a month")}
            </p>
          )}
          <p className="mt-1 text-[11px] text-amber-700">{t("The company's modules change to the plan's when you save.")}</p>
        </div>
        {current?.overridden.includes("modules") && current.planId === planId && (
          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-gray-300">
            <input type="checkbox" className="mt-0.5" checked={keepModules} onChange={(e) => setKeepModules(e.target.checked)} />
            {t("Keep the modules agreed for this company")} ({current.modules.length})
          </label>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Agreed differently for this company (empty: the plan's)")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="tp-users">{t("Most users")}</label>
              <input id="tp-users" type="number" min={1} className={INPUT} value={maxUsers} placeholder={plan?.maxUsers?.toString() ?? t("No limit")}
                onChange={(e) => setMaxUsers(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="tp-storage">{t("Most storage (MB)")}</label>
              <input id="tp-storage" type="number" min={1} className={INPUT} value={maxStorage} placeholder={plan?.maxStorageMb?.toString() ?? t("No limit")}
                onChange={(e) => setMaxStorage(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="tp-monthly">{t("Monthly price")}</label>
              <input id="tp-monthly" type="number" min={0} step="0.001" className={INPUT} value={monthly} placeholder={plan?.monthlyPrice?.toString() ?? ""}
                onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="tp-yearly">{t("Yearly price")}</label>
              <input id="tp-yearly" type="number" min={0} step="0.001" className={INPUT} value={yearly} placeholder={plan?.yearlyPrice?.toString() ?? ""}
                onChange={(e) => setYearly(e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <label className={LABEL} htmlFor="tp-note">{t("Note")}</label>
          <input id="tp-note" className={INPUT} value={note} maxLength={500} placeholder={t("e.g. Launch discount until March")}
            onChange={(e) => setNote(e.target.value)} />
        </div>
        {current && current.planId === planId && (
          <TenantSubscriptionPanel tenantId={tenant.tenantId} plan={current} onChanged={onSaved} />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>{t("Cancel")}</button>
          <button type="button" className={PRIMARY_BUTTON} disabled={saving || !planId} onClick={save}>{t(saving ? "Saving..." : "Save")}</button>
        </div>
      </div>
    </div>
  );
}
