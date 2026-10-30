import { useEffect, useMemo, useState } from "react";
import { Bell, Globe2, Palette, Save } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { ADD_BUTTON_COLORS } from "../../components/common/AddButton";
import { CARD, CARD_TITLE, PAGE_BODY, TOOL_BUTTON } from "../Payroll/hrmsUi";
import { DATE_FORMATS, LANGUAGES, formatDateIn, formatTimeIn, timeZones } from "../../company/regional";
import { loadPreferences, NO_PREFERENCES, savePreferences, UserPreferences } from "../../user/preferences";
import { t } from "../../i18n/i18n";
import TwoStepSignInCard from "./TwoStepSignInCard";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const HINT = "mt-1 text-[11px] text-slate-500";

const sectionTitle = (Icon: React.ComponentType<{ className?: string }>, text: string) => (
  <h3 className={`${CARD_TITLE} mb-3 flex items-center gap-2`}>
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgb(var(--brand-50,224_247_250))] text-[rgb(var(--brand-600,0_151_167))] dark:bg-cyan-950/40 dark:text-cyan-300">
      <Icon className="h-4 w-4" />
    </span>
    {t(text)}
  </h3>
);

/**
 * The signed-in user's own settings: language, time zone, date and time format, theme and notification emails.
 * Each one left on "Company default" follows Company Settings; business dates (due dates, "today") always keep
 * the company's time zone.
 */
export default function MyPreferences() {
  const [saved, setSaved] = useState<UserPreferences | null>(null);
  const [form, setForm] = useState<UserPreferences>(NO_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences().then((prefs) => {
      const value = prefs ?? NO_PREFERENCES;
      setSaved(value);
      setForm(value);
      setLoading(false);
    });
  }, []);

  const company = saved?.company;
  const zones = useMemo(() => timeZones(), []);
  const dirty = JSON.stringify({ ...form, company: null }) !== JSON.stringify({ ...(saved ?? NO_PREFERENCES), company: null });
  const set = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await savePreferences(form);
      setSaved(result);
      setForm(result);
      ToasterService.success(t("Your preferences are saved."));
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not save your preferences.")));
    } finally {
      setSaving(false);
    }
  };

  // How times look with the choices on screen (or the company's)
  const zone = form.timeZone || company?.timeZone || "UTC";
  const now = new Date();
  const preview = `${formatDateIn(now, form.dateFormat || company?.dateFormat || "dd/MM/yyyy", zone)} ${formatTimeIn(now, form.timeFormat || company?.timeFormat || "12h", zone)}`;
  const companyDefault = (value?: string | null) => `${t("Company default")}${value ? ` (${value})` : ""}`;
  const languageName = (value?: string | null) => LANGUAGES.find((l) => l.value === value)?.label ?? value;

  return (
    <>
      <PageMeta title={t("My preferences")} description="Your own language, time zone, date format, theme and notifications" />
      <PageBreadcrumb
        pageTitle="My preferences"
        actions={!loading ? (
          <div className="flex items-center gap-2">
            <button type="button" className={TOOL_BUTTON} disabled={!dirty} onClick={() => setForm(saved ?? NO_PREFERENCES)}>
              {t("Discard changes")}
            </button>
            <button type="submit" form="my-preferences-form" className={`${TOOL_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={saving || !dirty}>
              <Save className="h-3.5 w-3.5" />
              {t(saving ? "Saving..." : "Save")}
            </button>
          </div>
        ) : undefined}
      />

      <div className={PAGE_BODY}>
        {loading ? (
          <div className={`${CARD} p-6 text-sm text-slate-400`}>{t("Loading...")}</div>
        ) : (
          <form id="my-preferences-form" onSubmit={save} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className={`${CARD} p-4`}>
              {sectionTitle(Globe2, "Language, time zone and formats")}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="pref-language">{t("Language")}</label>
                  <select id="pref-language" className={INPUT} value={form.language ?? ""}
                    onChange={(e) => set("language", (e.target.value || null) as UserPreferences["language"])}>
                    <option value="">{companyDefault(languageName(company?.language))}</option>
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor="pref-timeZone">{t("Time zone")}</label>
                  <select id="pref-timeZone" className={INPUT} value={form.timeZone ?? ""}
                    onChange={(e) => set("timeZone", e.target.value || null)}>
                    <option value="">{companyDefault(company?.timeZone)}</option>
                    {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <p className={HINT}>{t("Times are shown in this zone; due dates and \"today\" keep the company's.")}</p>
                </div>
                <div>
                  <label className={LABEL} htmlFor="pref-dateFormat">{t("Date format")}</label>
                  <select id="pref-dateFormat" className={INPUT} value={form.dateFormat ?? ""}
                    onChange={(e) => set("dateFormat", e.target.value || null)}>
                    <option value="">{companyDefault(company?.dateFormat)}</option>
                    {DATE_FORMATS.map((f) => <option key={f} value={f}>{formatDateIn(now, f, zone)} ({f})</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor="pref-timeFormat">{t("Time format")}</label>
                  <select id="pref-timeFormat" className={INPUT} value={form.timeFormat ?? ""}
                    onChange={(e) => set("timeFormat", (e.target.value || null) as UserPreferences["timeFormat"])}>
                    <option value="">{companyDefault(company?.timeFormat)}</option>
                    <option value="12h">{t("12-hour")}</option>
                    <option value="24h">{t("24-hour")}</option>
                  </select>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-gray-300">
                {t("Now")}: <strong>{preview}</strong>
              </p>
            </section>

            <div className="space-y-4">
              <section className={`${CARD} p-4`}>
                {sectionTitle(Palette, "Theme")}
                <div className="flex flex-wrap gap-2">
                  {([["", "Follow this browser"], ["light", "Light"], ["dark", "Dark"]] as const).map(([value, label]) => (
                    <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      (form.theme ?? "") === value ? "border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200" : "border-slate-200 text-slate-700 dark:border-gray-700 dark:text-gray-300"}`}>
                      <input type="radio" name="theme" className="accent-cyan-600" checked={(form.theme ?? "") === value}
                        onChange={() => set("theme", (value || null) as UserPreferences["theme"])} />
                      {t(label)}
                    </label>
                  ))}
                </div>
                <p className={HINT}>{t("The sun / moon button in the header also changes it.")}</p>
              </section>

              <section className={`${CARD} p-4`}>
                {sectionTitle(Bell, "Notifications")}
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300">
                  <input type="checkbox" className="mt-0.5 accent-cyan-600" checked={form.emailNotifications !== false}
                    onChange={(e) => set("emailNotifications", e.target.checked ? null : false)} />
                  <span>
                    {t("Email me notifications (approvals, low stock, overdue invoices)")}
                    <span className={`${HINT} block`}>{t("They always appear under the bell, whichever you choose.")}</span>
                  </span>
                </label>
              </section>
            </div>
          </form>
        )}
        {!loading && <div className="mt-4"><TwoStepSignInCard /></div>}
      </div>
    </>
  );
}
