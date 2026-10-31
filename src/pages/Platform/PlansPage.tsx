import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import { APP_MODULES, AppModule, MODULE_LABELS } from "../../access/access";
import { errorText } from "../../access/accessApi";
import { BillingEvent, Plan, PlanForm, limitText, planPrice as price, plansApi, storageText } from "../../platform/plansApi";
import { formatDateTime } from "../../company/format";
import { CARD, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const OPTIONAL_MODULES = APP_MODULES.filter((m) => m !== "USERS");

const EMPTY: PlanForm = {
  code: "", name: "", description: "", modules: [], maxUsers: null, maxStorageMb: null, monthlyPrice: null, yearlyPrice: null,
  currency: "", active: true, sortOrder: 0,
};

const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

const EVENT_TONE: Record<BillingEvent["status"], string> = {
  SENT: "bg-emerald-50 text-emerald-700", PENDING: "bg-sky-50 text-sky-700", FAILED: "bg-red-50 text-red-700", NOT_SENT: "bg-slate-100 text-slate-500",
};

/** What was sent to the outside billing system (plan changes, trials, renewals, lapses, expiries). */
function BillingEvents() {
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const load = () => plansApi.billingEvents().then(setEvents).catch(() => setEvents([]));

  useEffect(() => {
    load();
  }, []);

  const resend = async (id: string) => {
    try {
      await plansApi.resendEvent(id);
      ToasterService.success(t("Sent again."));
      load();
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not send the event.")));
    }
  };

  return (
    <section className={`${CARD} mt-4 p-4`}>
      <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t("Billing events")}</h3>
      <p className="mb-3 text-[11px] text-slate-500 dark:text-gray-400">
        {t("Sent to the billing system's webhook (billing.webhook-url setting on the user service); failed ones are retried every 10 minutes, 5 times.")}
      </p>
      {events.length === 0 ? <p className="text-xs text-slate-400">{t("No events yet.")}</p> : (
        <ul className="divide-y divide-slate-100 text-xs dark:divide-gray-800">
          {events.slice(0, 30).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="w-36 text-slate-500">{formatDateTime(`${e.createdAt}Z`)}</span>
              <span className="font-semibold text-slate-800 dark:text-gray-100">{e.type}</span>
              <span className="text-slate-500">{e.tenantId}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_TONE[e.status]}`}>{e.status}</span>
              {e.lastError && <span className="truncate text-[11px] text-red-600" title={e.lastError}>{e.lastError}</span>}
              {e.status === "FAILED" && (
                <button type="button" className="ms-auto text-[11px] font-semibold text-cyan-700 hover:underline" onClick={() => resend(e.id)}>
                  {t("Send again")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Super Admin: the plans companies subscribe to — modules, user and storage limits, prices. */
export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await plansApi.list());
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not load the plans.")));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (plan: Plan | "new") => {
    setEditing(plan);
    setForm(plan === "new" ? EMPTY : { ...plan, modules: plan.modules.filter((m) => m !== "USERS"), description: plan.description ?? "",
      currency: plan.currency ?? "" });
  };

  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (m: AppModule) => set("modules", form.modules.includes(m) ? form.modules.filter((x) => x !== m) : [...form.modules, m]);

  const save = async () => {
    if (!form.name.trim() || (editing === "new" && !form.code.trim())) {
      ToasterService.error(t("Enter the plan's code and name."));
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") await plansApi.create(form);
      else if (editing) await plansApi.update(editing.id, form);
      ToasterService.success(`${form.name.trim()} ${t("saved.")}`);
      setEditing(null);
      load();
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not save the plan.")));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plan: Plan) => {
    if (!window.confirm(`${t("Delete plan")} ${plan.name}?`)) return;
    try {
      await plansApi.remove(plan.id);
      load();
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not delete the plan.")));
    }
  };

  const columns: ColumnDef<Plan>[] = [
    {
      key: "name", label: "Plan", sortable: true,
      render: (p) => (
        <div>
          <span className="block text-xs font-semibold text-slate-900 dark:text-white">
            {p.name}
            {!p.active && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{t("Inactive")}</span>}
          </span>
          <span className="text-[11px] text-slate-500">{p.code}</span>
        </div>
      ),
    },
    {
      key: "modules", label: "Modules",
      render: (p) => (
        <div className="flex max-w-xs flex-wrap gap-1">
          {p.modules.map((m) => (
            <span key={m} className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
              {MODULE_LABELS[m as AppModule] ?? m}
            </span>
          ))}
        </div>
      ),
    },
    { key: "maxUsers", label: "Users", render: (p) => t(limitText(p.maxUsers, "users")) },
    { key: "maxStorageMb", label: "Storage", render: (p) => t(storageText(p.maxStorageMb)) },
    { key: "monthlyPrice", label: "Monthly", render: (p) => price(p.monthlyPrice, p.currency) },
    { key: "yearlyPrice", label: "Yearly", render: (p) => price(p.yearlyPrice, p.currency) },
    { key: "companies", label: "Companies", sortable: true },
    {
      key: "actions", label: "Actions",
      render: (p) => (
        <div className="flex items-center gap-1">
          <button type="button" title={t("Edit")} className={ROW_ICON_BUTTON} onClick={() => open(p)}><Pencil className="h-4 w-4" /></button>
          <button type="button" title={t(p.companies > 0 ? "In use: make it inactive instead" : "Delete")} className={ROW_ICON_BUTTON_DANGER}
            disabled={p.companies > 0} onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Plans")} description="Subscription plans: modules, limits and prices" />
      <PageBreadcrumb pageTitle="Plans" actions={<AddButton label={t("New plan")} permission={null} onClick={() => open("new")} />} />
      <div className={PAGE_BODY}>
        <p className="mb-3 text-xs text-slate-600 dark:text-gray-300">
          {t("A company's modules follow its plan. Give a company a plan, or agree different limits or prices for it, on Tenants & Modules.")}
        </p>
        <ReusableTable data={plans} columns={columns} loading={loading} pageSize={10} defaultSortKey="name" enableRowDetails={false} />
        <BillingEvents />
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD} max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto p-5`} role="dialog" aria-labelledby="plan-title">
            <div className="flex items-center justify-between">
              <h3 id="plan-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                {editing === "new" ? t("New plan") : `${t("Edit")} ${editing.name}`}
              </h3>
              <button type="button" aria-label={t("Close")} onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="plan-code">{t("Code")}</label>
                <input id="plan-code" className={`${INPUT} uppercase`} value={form.code} maxLength={30} disabled={editing !== "new"}
                  placeholder="BUSINESS" onChange={(e) => set("code", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-name">{t("Name")}</label>
                <input id="plan-name" className={INPUT} value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="plan-description">{t("Description")}</label>
              <input id="plan-description" className={INPUT} value={form.description ?? ""} maxLength={500}
                onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>{t("Modules")}</label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-gray-700">
                {OPTIONAL_MODULES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-xs text-slate-700 dark:text-gray-300">
                    <input type="checkbox" checked={form.modules.includes(m)} onChange={() => toggle(m)} />
                    {MODULE_LABELS[m]}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{t("Users is a core module and is always on.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="plan-users">{t("Most users")}</label>
                <input id="plan-users" type="number" min={1} className={INPUT} value={form.maxUsers ?? ""} placeholder={t("No limit")}
                  onChange={(e) => set("maxUsers", numberOrNull(e.target.value))} />
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-storage">{t("Most storage (MB)")}</label>
                <input id="plan-storage" type="number" min={1} className={INPUT} value={form.maxStorageMb ?? ""} placeholder={t("No limit")}
                  onChange={(e) => set("maxStorageMb", numberOrNull(e.target.value))} />
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-monthly">{t("Monthly price")}</label>
                <input id="plan-monthly" type="number" min={0} step="0.001" className={INPUT} value={form.monthlyPrice ?? ""}
                  onChange={(e) => set("monthlyPrice", numberOrNull(e.target.value))} />
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-yearly">{t("Yearly price")}</label>
                <input id="plan-yearly" type="number" min={0} step="0.001" className={INPUT} value={form.yearlyPrice ?? ""}
                  onChange={(e) => set("yearlyPrice", numberOrNull(e.target.value))} />
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-currency">{t("Currency")}</label>
                <input id="plan-currency" className={`${INPUT} uppercase`} value={form.currency ?? ""} maxLength={3} placeholder="AED"
                  onChange={(e) => set("currency", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-order">{t("Order in lists")}</label>
                <input id="plan-order" type="number" className={INPUT} value={form.sortOrder}
                  onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-gray-300">
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
              {t("Active (can be given to companies)")}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(null)}>{t("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={save}>{t(saving ? "Saving..." : "Save")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
