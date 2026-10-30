import { useContext, useEffect, useMemo, useState } from "react";
import { BellRing, Mail, RotateCcw, Save, Send } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { hasPermission } from "../../access/access";
import { AuthContext } from "../../context/AuthContext";
import { EmailTemplate, NotificationSettings, notificationsApi } from "../../notifications/notificationsApi";
import { ADD_BUTTON_COLORS } from "../../components/common/AddButton";
import { CARD, CARD_TITLE, PAGE_BODY, TOOL_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const HINT = "mt-1 text-[11px] text-slate-500 dark:text-gray-400";
const EMAIL = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

const DEFAULTS: NotificationSettings = {
  emailApprovals: false, emailLowStock: false, emailOverdueInvoices: false, dunningEnabled: false,
  dunningDaysBefore: 3, dunningRepeatDays: 7, dunningMaxReminders: 3, replyTo: "",
};

const sectionTitle = (Icon: React.ComponentType<{ className?: string }>, text: string) => (
  <h3 className={`${CARD_TITLE} mb-3 flex items-center gap-2`}>
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgb(var(--brand-50,224_247_250))] text-[rgb(var(--brand-600,0_151_167))] dark:bg-cyan-950/40 dark:text-cyan-300">
      <Icon className="h-4 w-4" />
    </span>
    {t(text)}
  </h3>
);

function Toggle({ id, label, hint, checked, disabled, onChange }: {
  id: string; label: string; hint: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 dark:border-gray-800">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 accent-cyan-600" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-slate-800 dark:text-gray-100">{label}</span>
        <span className="block text-[11px] text-slate-500 dark:text-gray-400">{hint}</span>
      </span>
    </label>
  );
}

/** One email template: the company's text, or the built-in one until it is changed. */
function TemplateEditor({ template, editable, onSaved }: {
  template: EmailTemplate; editable: boolean; onSaved: (t: EmailTemplate) => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);
  const dirty = subject !== template.subject || body !== template.body;

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
  }, [template]);

  const run = async (action: () => Promise<EmailTemplate>, done: string) => {
    setBusy(true);
    try {
      onSaved(await action());
      ToasterService.success(done);
    } catch (err) {
      ToasterService.error("The template could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-gray-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
          {template.name}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${template.customised ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-500"}`}>
            {t(template.customised ? "Your text" : "Built-in text")}
          </span>
        </p>
        {editable && (
          <div className="flex gap-2">
            {template.customised && (
              <button type="button" className={TOOL_BUTTON} disabled={busy}
                onClick={() => run(() => notificationsApi.resetTemplate(template.code), "Back to the built-in text.")}>
                <RotateCcw className="h-3.5 w-3.5" /> {t("Use built-in text")}
              </button>
            )}
            <button type="button" className={`${TOOL_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={busy || !dirty}
              onClick={() => run(() => notificationsApi.saveTemplate(template.code, subject, body), `${template.name} saved.`)}>
              <Save className="h-3.5 w-3.5" /> {t("Save template")}
            </button>
          </div>
        )}
      </div>
      <label className={LABEL} htmlFor={`tpl-subject-${template.code}`}>{t("Subject")}</label>
      <input id={`tpl-subject-${template.code}`} className={INPUT} value={subject} maxLength={300} disabled={!editable}
        onChange={(e) => setSubject(e.target.value)} />
      <label className={`${LABEL} mt-3`} htmlFor={`tpl-body-${template.code}`}>{t("Message")}</label>
      <textarea id={`tpl-body-${template.code}`} className={`${INPUT} min-h-[150px] font-mono text-xs`} value={body} disabled={!editable}
        onChange={(e) => setBody(e.target.value)} />
      <p className={HINT}>
        {t("You can use:")} {template.placeholders.map((p) => <code key={p} className="mr-1 rounded bg-slate-100 px-1 dark:bg-gray-800">{"${" + p + "}"}</code>)}
      </p>
    </div>
  );
}

/**
 * Who hears about what: in-app notifications are always on; emails to staff and payment reminders to
 * customers are the company's choice. Tenant Administrators (USERS:ADMIN) change them.
 */
export default function NotificationSettingsPage() {
  const { access } = useContext(AuthContext);
  const editable = hasPermission(access, "USERS:ADMIN");
  const [saved, setSaved] = useState<NotificationSettings | null>(null);
  const [form, setForm] = useState<NotificationSettings>(DEFAULTS);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([notificationsApi.settings(), notificationsApi.templates()])
      .then(([settings, list]) => {
        const loaded = { ...DEFAULTS, ...settings, replyTo: settings.replyTo ?? "" };
        setSaved(loaded);
        setForm(loaded);
        setTemplates(list);
      })
      .catch((err) => ToasterService.error("Notification settings could not be loaded", errorText(err, "Is the notification service running?")))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => saved !== null && JSON.stringify(saved) !== JSON.stringify(form), [saved, form]);
  const set = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const number = (key: "dunningDaysBefore" | "dunningRepeatDays" | "dunningMaxReminders") => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, Math.max(0, Math.round(Number(e.target.value) || 0)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const replyTo = (form.replyTo ?? "").trim();
    if (replyTo && !EMAIL.test(replyTo)) {
      ToasterService.error("Enter a valid reply-to email address, or leave it empty.");
      return;
    }
    setSaving(true);
    try {
      const result = await notificationsApi.saveSettings({ ...form, replyTo: replyTo || null });
      const next = { ...DEFAULTS, ...result, replyTo: result.replyTo ?? "" };
      setSaved(next);
      setForm(next);
      ToasterService.success("Notification settings saved.");
    } catch (err) {
      ToasterService.error("The settings could not be saved", errorText(err, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title={t("Notification Settings")} description="Alerts to staff and payment reminders to customers" />
      <PageBreadcrumb
        pageTitle="Notification Settings"
        actions={editable ? (
          <div className="flex items-center gap-2">
            <button type="button" className={TOOL_BUTTON} disabled={!dirty} onClick={() => saved && setForm(saved)}>{t("Discard changes")}</button>
            <button type="submit" form="notification-settings-form" className={`${TOOL_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={saving || !dirty}>
              <Save className="h-3.5 w-3.5" /> {t(saving ? "Saving..." : "Save")}
            </button>
          </div>
        ) : undefined}
      />
      <div className={PAGE_BODY}>
        {loading ? (
          <div className={`${CARD} p-6 text-sm text-slate-400`}>{t("Loading...")}</div>
        ) : (
          <form id="notification-settings-form" onSubmit={save} className="space-y-4">
            {!editable && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t("Only a Tenant Administrator can change these settings.")}
              </p>
            )}

            <section className={`${CARD} p-5`}>
              {sectionTitle(BellRing, "Alerts to staff")}
              <p className="mb-3 text-xs text-slate-600 dark:text-gray-300">
                {t("Everyone sees their alerts under the bell at the top: approvers when a requisition or purchase order waits for them, stock and purchasing staff when stock falls to its reorder level, finance when an invoice becomes overdue. They can also get them by email:")}
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <Toggle id="ns-approvals" label={t("Email approvers")} hint={t("Requisitions and purchase orders waiting for approval, and the decision to the requester.")}
                  checked={form.emailApprovals} disabled={!editable} onChange={(v) => set("emailApprovals", v)} />
                <Toggle id="ns-stock" label={t("Email low stock")} hint={t("To people with inventory or purchasing rights.")}
                  checked={form.emailLowStock} disabled={!editable} onChange={(v) => set("emailLowStock", v)} />
                <Toggle id="ns-overdue" label={t("Email overdue invoices")} hint={t("To people who manage invoices and receipts.")}
                  checked={form.emailOverdueInvoices} disabled={!editable} onChange={(v) => set("emailOverdueInvoices", v)} />
              </div>
            </section>

            <section className={`${CARD} p-5`}>
              {sectionTitle(Send, "Payment reminders to customers")}
              <Toggle id="ns-dunning" label={t("Send automatic payment reminders")}
                hint={t("Emailed in the morning (company time) to the customer email on each unpaid invoice, with the templates below. A reminder can also be sent by hand from Invoices.")}
                checked={form.dunningEnabled} disabled={!editable} onChange={(v) => set("dunningEnabled", v)} />
              <div className="mt-3 grid gap-4 md:grid-cols-4">
                <div>
                  <label className={LABEL} htmlFor="ns-before">{t("Days before the due date")}</label>
                  <input id="ns-before" type="number" min={0} max={30} className={INPUT} value={form.dunningDaysBefore}
                    disabled={!editable || !form.dunningEnabled} onChange={number("dunningDaysBefore")} />
                  <p className={HINT}>{t("One friendly reminder; 0 = none.")}</p>
                </div>
                <div>
                  <label className={LABEL} htmlFor="ns-repeat">{t("Then every (days)")}</label>
                  <input id="ns-repeat" type="number" min={1} max={60} className={INPUT} value={form.dunningRepeatDays}
                    disabled={!editable || !form.dunningEnabled} onChange={number("dunningRepeatDays")} />
                  <p className={HINT}>{t("After the due date; the first goes the next day.")}</p>
                </div>
                <div>
                  <label className={LABEL} htmlFor="ns-max">{t("At most (overdue reminders)")}</label>
                  <input id="ns-max" type="number" min={1} max={12} className={INPUT} value={form.dunningMaxReminders}
                    disabled={!editable || !form.dunningEnabled} onChange={number("dunningMaxReminders")} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="ns-reply">{t("Replies go to")}</label>
                  <input id="ns-reply" type="email" className={INPUT} value={form.replyTo ?? ""} placeholder={t("accounts@yourcompany.com")}
                    disabled={!editable} onChange={(e) => set("replyTo", e.target.value)} />
                  <p className={HINT}>{t("Empty: the company email on the invoice.")}</p>
                </div>
              </div>
            </section>
          </form>
        )}

        {!loading && templates.length > 0 && (
          <section className={`${CARD} mt-4 p-5`}>
            {sectionTitle(Mail, "Email templates")}
            <p className="mb-3 text-xs text-slate-600 dark:text-gray-300">
              Write them in your customers' language; blank lines start a new paragraph.
            </p>
            <div className="space-y-3">
              {templates.map((t) => (
                <TemplateEditor key={t.code} template={t} editable={editable}
                  onSaved={(next) => setTemplates((list) => list.map((x) => (x.code === next.code ? next : x)))} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
