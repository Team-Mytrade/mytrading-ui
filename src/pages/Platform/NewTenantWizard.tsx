import { FormEvent, ReactNode, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Building2, Check, CheckCircle2, LayoutGrid, Mail, Pencil, ShieldCheck, UserRound, X,
} from "lucide-react";
import MenuPagePicker from "./MenuPagePicker";
import { AppModule, MODULE_LABELS } from "../../access/access";
import { TenantAccess, platformApi } from "../../access/accessApi";
import { MenuPage, pageOn, pickerGroups, switchPages } from "../../access/menuPages";
import type { Plan } from "../../platform/plansApi";
import { ToasterService } from "../../Services/ToasterService";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

/*
 * New tenant, step by step: the company and its plan, its main menus and sub menus, its first Tenant Administrator,
 * and a review where anything can still be changed (sub menus unticked right there) before it is created.
 */

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1.5 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const EMAIL = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

const STEPS = [
  { key: "company", label: "Company", hint: "Name the company and choose how it is billed.", icon: Building2 },
  { key: "menus", label: "Menus", hint: "Choose the main menus and sub menus it gets.", icon: LayoutGrid },
  { key: "admin", label: "Administrator", hint: "Who runs the company's account.", icon: UserRound },
  { key: "review", label: "Review", hint: "Check everything; untick any sub menu before you create.", icon: ShieldCheck },
] as const;

interface Form {
  tenantName: string;
  planId: number | "";
  modules: AppModule[];
  hiddenPages: string[];
  firstName: string;
  lastName: string;
  email: string;
}

const EMPTY: Form = { tenantName: "", planId: "", modules: [], hiddenPages: [], firstName: "", lastName: "", email: "" };

interface Props {
  plans: Plan[];
  onClose: () => void;
  onCreated: (tenant: TenantAccess) => void;
}

const money = (amount: number | null, currency: string | null) =>
  amount == null ? null : `${currency ?? ""} ${amount.toLocaleString()}`.trim();

export default function NewTenantWizard({ plans, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // The main menus listed on the review: those chosen when it opened, so one unticked there can be ticked back
  const [reviewMenus, setReviewMenus] = useState<string[]>([]);

  const groups = useMemo(pickerGroups, []);
  const activePlans = plans.filter((p) => p.active);
  const plan = activePlans.find((p) => p.id === form.planId) ?? null;
  const on = (p: MenuPage) => pageOn(p, form.modules, form.hiddenPages);
  const tickedPages = groups.flatMap((g) => g.pages).filter(on);
  const tickedMenus = groups.filter((g) => g.pages.some(on));
  const change = (changes: { page: MenuPage; on: boolean }[]) => setForm((f) => ({ ...f, ...switchPages(f.modules, f.hiddenPages, changes) }));

  /** What stops the step from being left, if anything. */
  const blocker = (i: number): string | null => {
    if (i === 0 && !form.tenantName.trim()) return "Enter the company name.";
    if (i === 2) {
      if (!form.firstName.trim() || !form.lastName.trim()) return "Enter the administrator's first and last name.";
      if (!EMAIL.test(form.email.trim())) return "Enter the administrator's email address.";
    }
    return null;
  };

  const go = (target: number) => {
    // Forward only through steps that are complete
    for (let i = step; i < target; i++) {
      const why = blocker(i);
      if (why) {
        setStep(i);
        setProblem(why);
        return;
      }
    }
    setProblem(null);
    if (target === 3) setReviewMenus(tickedMenus.map((g) => g.menu));
    setStep(target);
    setReached((r) => Math.max(r, target));
    bodyRef.current?.scrollTo({ top: 0 });
  };

  const create = async () => {
    for (const i of [0, 2]) {
      const why = blocker(i);
      if (why) {
        setStep(i);
        setProblem(why);
        return;
      }
    }
    setSaving(true);
    try {
      const email = form.email.trim().toLowerCase();
      const { tenant, inviteSent } = await platformApi.provision({
        tenantName: form.tenantName.trim(),
        modules: plan ? [] : form.modules,
        hiddenPages: plan ? [] : form.hiddenPages,
        planId: plan?.id,
        admin: { username: email, email, firstName: form.firstName.trim(), lastName: form.lastName.trim() },
      });
      if (inviteSent) ToasterService.success(`${tenant.tenantName} ${t("created.")} ${form.firstName.trim()} ${t("was emailed a link to set a password.")}`);
      else ToasterService.error(`${tenant.tenantName} ${t("was created, but the invite email could not be sent. Use \"Send invite\" to try again.")}`);
      onCreated(tenant);
    } catch (err) {
      setProblem((err as Error)?.message || "Could not create the tenant.");
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step < 3) go(step + 1);
    else void create();
  };

  const current = STEPS[step];

  return (
    <div data-overlay-dim data-overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form data-overlay-panel onSubmit={submit} role="dialog" aria-labelledby="new-tenant-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#191919]">
        {/* Header */}
        <div data-overlay-header className="flex items-start justify-between gap-3 border-b px-6 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/25">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h3 id="new-tenant-title" className="text-base font-semibold text-slate-900 dark:text-white">{t("New tenant")}</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">{t(current.hint)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("Close")} className="rounded-full p-1.5 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <ol className="flex items-center gap-1 border-b border-slate-100 px-6 py-3 dark:border-gray-800">
          {STEPS.map((s, i) => {
            const done = i < step || (i <= reached && i !== step && !blocker(i));
            const active = i === step;
            const Icon = s.icon;
            return (
              <li key={s.key} className="flex flex-1 items-center gap-1 last:flex-none">
                <button type="button" disabled={i > reached} onClick={() => go(i)}
                  className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-semibold transition disabled:cursor-default ${
                    active ? "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-800"
                      : done ? "text-slate-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-white/5" : "text-slate-400 dark:text-gray-500"}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                    active ? "bg-cyan-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {done && !active ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="hidden sm:inline">{t(s.label)}</span>
                </button>
                {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-emerald-300" : "bg-slate-200 dark:bg-gray-700"}`} />}
              </li>
            );
          })}
        </ol>

        {/* Body */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {problem && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t(problem)}
            </p>
          )}

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className={LABEL} htmlFor="tenant-name">{t("Company name *")}</label>
                <input id="tenant-name" autoFocus className={INPUT} value={form.tenantName} maxLength={255}
                  placeholder={t("e.g. Gulf Trading LLC")} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{t("It gets its own sign-in address from the name; you can change it later.")}</p>
              </div>
              <div>
                <p className={LABEL}>{t("Plan")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[null, ...activePlans].map((p) => {
                    const chosen = (p?.id ?? "") === form.planId;
                    const price = p && (money(p.monthlyPrice, p.currency) ?? money(p.yearlyPrice, p.currency));
                    return (
                      <button key={p?.id ?? "none"} type="button" aria-pressed={chosen}
                        onClick={() => setForm({ ...form, planId: p?.id ?? "" })}
                        className={`relative rounded-xl border p-3.5 text-left transition ${chosen
                          ? "border-cyan-400 bg-cyan-50/70 ring-2 ring-cyan-500/20 dark:border-cyan-700 dark:bg-cyan-950/30"
                          : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/30 dark:border-gray-700 dark:bg-transparent dark:hover:border-cyan-800"}`}>
                        {chosen && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-cyan-600" />}
                        <span className="block pr-6 text-sm font-semibold text-slate-900 dark:text-white">{p ? p.name : t("No plan")}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-gray-400">
                          {p ? (p.description || `${p.modules.length} ${t("modules")}`) : t("Choose the menus yourself in the next step.")}
                        </span>
                        {p && (
                          <span className="mt-2 flex flex-wrap gap-1">
                            {p.modules.filter((m) => m !== "USERS").map((m) => (
                              <span key={m} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-transparent dark:text-gray-300 dark:ring-gray-700">
                                {t(MODULE_LABELS[m as AppModule] ?? m)}
                              </span>
                            ))}
                          </span>
                        )}
                        {p && (price || p.maxUsers != null) && (
                          <span className="mt-2 block text-[11px] font-medium text-slate-700 dark:text-gray-300">
                            {price && <>{price} / {t(p.monthlyPrice != null ? "month" : "year")}</>}
                            {price && p.maxUsers != null && " · "}
                            {p.maxUsers != null && <>{t("up to")} {p.maxUsers} {t("users")}</>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (plan ? (
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm text-slate-700 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:text-gray-200">
              <p className="font-semibold">{t("The plan decides the menus")}: {plan.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.modules.filter((m) => m !== "USERS").map((m) => (
                  <span key={m} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-cyan-800 ring-1 ring-cyan-200 dark:bg-transparent dark:text-cyan-200 dark:ring-cyan-800">
                    {t(MODULE_LABELS[m as AppModule] ?? m)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">
                {t("Every sub menu of these modules is included. To hide some, choose No plan, or use Edit on the company after it is created.")}
              </p>
            </div>
          ) : (
            <MenuPagePicker modules={form.modules} hiddenPages={form.hiddenPages}
              onChange={(modules, hiddenPages) => setForm({ ...form, modules, hiddenPages })} />
          ))}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="tenant-admin-first">{t("First name *")}</label>
                  <input id="tenant-admin-first" autoFocus className={INPUT} value={form.firstName} maxLength={100}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="tenant-admin-last">{t("Last name *")}</label>
                  <input id="tenant-admin-last" className={INPUT} value={form.lastName} maxLength={100}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="tenant-admin-email">{t("Email (also their username) *")}</label>
                <input id="tenant-admin-email" className={INPUT} type="email" value={form.email} maxLength={150}
                  placeholder="name@company.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                <p>{t("They get an email to set their own password, then fill in the company details under Company Settings.")}</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewCard title={t("Company")} icon={<Building2 className="h-4 w-4" />} onEdit={() => go(0)}>
                  <p className="font-semibold text-slate-900 dark:text-white">{form.tenantName.trim()}</p>
                  <p className="text-slate-500 dark:text-gray-400">{t("Plan")}: {plan ? plan.name : t("No plan")}</p>
                </ReviewCard>
                <ReviewCard title={t("Tenant Administrator")} icon={<UserRound className="h-4 w-4" />} onEdit={() => go(2)}>
                  <p className="font-semibold text-slate-900 dark:text-white">{form.firstName.trim()} {form.lastName.trim()}</p>
                  <p className="text-slate-500 dark:text-gray-400">{form.email.trim().toLowerCase()}</p>
                </ReviewCard>
              </div>

              <ReviewCard title={t("Main menus and sub menus")} icon={<LayoutGrid className="h-4 w-4" />} onEdit={() => go(1)}
                aside={!plan && <span className="text-[11px] text-slate-500 dark:text-gray-400">{tickedMenus.length} {t("main menus")} · {tickedPages.length} {t("sub menus")}</span>}>
                {plan ? (
                  <div className="flex flex-wrap gap-1.5">
                    {plan.modules.filter((m) => m !== "USERS").map((m) => (
                      <span key={m} className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">{t(MODULE_LABELS[m as AppModule] ?? m)}</span>
                    ))}
                    <p className="mt-1 w-full text-[11px] text-slate-500 dark:text-gray-400">{t("Every sub menu of the plan's modules.")}</p>
                  </div>
                ) : reviewMenus.length === 0 ? (
                  <p className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />{t("No menus chosen: the company only gets Settings. Go back to Menus to add some.")}
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-[11px] text-slate-500 dark:text-gray-400">{t("Click a sub menu to leave it out (or put it back) before you create the company.")}</p>
                    <div className="space-y-3">
                      {groups.filter((g) => reviewMenus.includes(g.menu)).map((g) => {
                        const count = g.pages.filter(on).length;
                        return (
                          <div key={g.menu}>
                            <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-gray-100">
                              <input type="checkbox" checked={count === g.pages.length}
                                ref={(el) => { if (el) el.indeterminate = count > 0 && count < g.pages.length; }}
                                onChange={(e) => change(g.pages.map((page) => ({ page, on: e.target.checked })))} />
                              {t(g.menu)}
                              <span className="font-normal text-slate-400">{count} / {g.pages.length}</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5 pl-6">
                              {g.pages.map((p) => {
                                const isOn = on(p);
                                return (
                                  <button key={p.key} type="button" aria-pressed={isOn} onClick={() => change([{ page: p, on: !isOn }])}
                                    title={t(isOn ? "Click to leave out" : "Click to include")}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${isOn
                                      ? "bg-cyan-600 text-white shadow-sm hover:bg-cyan-700"
                                      : "bg-white text-slate-400 line-through ring-1 ring-slate-200 hover:text-slate-600 dark:bg-transparent dark:ring-gray-700"}`}>
                                    {isOn && <Check className="h-3 w-3" />}{t(p.name)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </ReviewCard>
              <p className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-gray-400">
                <Mail className="h-3.5 w-3.5 text-cyan-600" />
                {t("Creating the company emails")} {form.email.trim().toLowerCase()} {t("a link to set a password.")}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-3.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400">{t("Step")} {step + 1} {t("of")} {STEPS.length}</span>
          <div className="flex gap-2">
            {step === 0
              ? <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>{t("Cancel")}</button>
              : <button type="button" className={SECONDARY_BUTTON} onClick={() => { setProblem(null); setStep(step - 1); }}>{t("Back")}</button>}
            <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>
              {step < 3 ? t(step === 2 ? "Review" : "Next") : t(saving ? "Creating..." : "Confirm and create")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ReviewCard({ title, icon, onEdit, aside, children }: {
  title: string; icon: ReactNode; onEdit: () => void; aside?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-gray-700 dark:bg-transparent">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">
          <span className="text-cyan-600">{icon}</span>{title}
        </h4>
        <div className="flex items-center gap-3">
          {aside}
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:underline dark:text-cyan-300">
            <Pencil className="h-3 w-3" />{t("Change")}
          </button>
        </div>
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
