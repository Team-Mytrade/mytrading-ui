import { useEffect, useState } from "react";
import axios from "axios";
import { BellAlertIcon, ChartBarIcon, EyeIcon, ListBulletIcon, XMarkIcon, ArrowUpIcon, PlusIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { DEAL_STAGE_LABELS as STAGE_LABELS, apiError, fieldErrorOf } from "./crmShared";
import { CRM_SETTINGS_API, CrmSettings as Settings, rememberCrmSettings, useCrmSettings } from "./crmOwnership";
import { t } from "../../i18n/i18n";

// The lists a company starts with (the service's defaults)
const STANDARD_SOURCES = ["Walk-in", "Phone", "Website", "Exhibition", "Referral", "WhatsApp", "Social media", "Marketplace", "Other"];
const STANDARD_REASONS = ["Price", "Lost to competitor", "No budget", "No response", "Product not available", "Delivery time", "Other"];
const MAX_ITEMS = 30;
const MAX_LENGTH = 50;
// The stages whose probability a company sets (Won and Lost are fixed at 100 and 0)
const OPEN_STAGES = ["PROSPECTING", "QUALIFIED", "NEGOTIATION"];

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** One editable list: add, remove, move up; saved together. Read-only for people who aren't CRM admins. */
function ListEditor({
  title,
  help,
  items,
  standard,
  canChange,
  onSave,
}: {
  title: string;
  help: string;
  items: string[];
  standard: string[];
  canChange: boolean;
  onSave: (items: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string[]>(items);
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(items), [items]);

  const add = () => {
    const value = adding.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length > MAX_LENGTH) {
      ToasterService.error(t("Up to {n} characters", { n: String(MAX_LENGTH) }));
      return;
    }
    if (draft.some((d) => d.toLowerCase() === value.toLowerCase())) {
      ToasterService.info(t("Already on the list"));
      return;
    }
    if (draft.length >= MAX_ITEMS) {
      ToasterService.error(t("Up to {n} entries", { n: String(MAX_ITEMS) }));
      return;
    }
    setDraft([...draft, value]);
    setAdding("");
  };
  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...draft];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setDraft(next);
  };
  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };
  const changed = !same(draft, items);

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t(title)}</h3>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t(help)}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {draft.map((item, index) => (
          <li
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 py-1 ps-3 pe-1 text-xs font-medium text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100"
          >
            {item}
            {canChange && (
              <>
                {index > 0 && (
                  <button type="button" onClick={() => moveUp(index)} title={t("Move up")} aria-label={`${t("Move up")}: ${item}`}
                    className="rounded-full p-0.5 text-cyan-700 hover:bg-cyan-100 dark:text-cyan-300 dark:hover:bg-cyan-900">
                    <ArrowUpIcon className="h-3 w-3" />
                  </button>
                )}
                <button type="button" onClick={() => setDraft(draft.filter((d) => d !== item))} title={t("Remove")}
                  aria-label={`${t("Remove")}: ${item}`}
                  className="rounded-full p-0.5 text-cyan-700 hover:bg-cyan-100 dark:text-cyan-300 dark:hover:bg-cyan-900">
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {canChange && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={adding}
            maxLength={MAX_LENGTH}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={t("Add an entry")}
            aria-label={`${t(title)}: ${t("Add an entry")}`}
            className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button type="button" onClick={add}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-3 text-xs font-semibold text-cyan-700 hover:bg-cyan-100">
            <PlusIcon className="h-4 w-4" /> {t("Add")}
          </button>
          <div className="ms-auto flex items-center gap-2">
            {!same(draft, standard) && (
              <button type="button" onClick={() => setDraft(standard)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline">
                {t("Use the standard list")}
              </button>
            )}
            <button type="button" disabled={!changed || saving || draft.length === 0} onClick={save}
              className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? t("Saving…") : t("Save list")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** CRM → Settings: the company's own CRM rules. Everyone in the CRM can read them; CRM admins change them. */
export default function CrmSettings() {
  const { settings, setSettings, loading } = useCrmSettings();
  const [saving, setSaving] = useState(false);

  const put = async (change: Partial<Pick<Settings, "ownRecordsOnly" | "leadSources" | "lostReasons" | "idleDays" | "stageProbabilities">>) => {
    const res = await axios.put<Settings>(CRM_SETTINGS_API, change);
    setSettings(res.data);
    rememberCrmSettings(res.data);
    return res.data;
  };

  const setOwnRecordsOnly = async (ownRecordsOnly: boolean) => {
    if (!settings.canChange || saving) return;
    try {
      setSaving(true);
      await put({ ownRecordsOnly });
      ToasterService.success(
        t(ownRecordsOnly ? "Sales people now see only their own leads and deals" : "Everyone in the CRM now sees all leads and deals")
      );
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to save the CRM settings"));
    } finally {
      setSaving(false);
    }
  };

  const saveList = (field: "leadSources" | "lostReasons") => async (items: string[]) => {
    try {
      await put({ [field]: items });
      ToasterService.success(t("List saved"));
    } catch (err) {
      const message = apiError(err, "Failed to save the CRM settings");
      ToasterService.error(Object.values(fieldErrorOf(message))[0] || message);
    }
  };

  const on = settings.ownRecordsOnly;
  const [idleDraft, setIdleDraft] = useState<string>("");
  useEffect(() => setIdleDraft(String(settings.idleDays ?? 14)), [settings.idleDays]);
  const idleValue = Number(idleDraft);
  const idleValid = idleDraft.trim() !== "" && Number.isInteger(idleValue) && idleValue >= 0 && idleValue <= 365;
  const saveIdle = async () => {
    if (!idleValid) return;
    try {
      setSaving(true);
      await put({ idleDays: idleValue });
      ToasterService.success(t(idleValue === 0 ? "Follow-up reminders are off" : "Follow-up reminders saved"));
    } catch (err) {
      const message = apiError(err, "Failed to save the CRM settings");
      ToasterService.error(Object.values(fieldErrorOf(message))[0] || message);
    } finally {
      setSaving(false);
    }
  };

  // Each open stage's default win probability (8.3.3); Won and Lost are fixed
  const [probabilityDraft, setProbabilityDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    setProbabilityDraft(Object.fromEntries(OPEN_STAGES.map((s) => [s, String(settings.stageProbabilities?.[s] ?? "")])));
  }, [settings.stageProbabilities]);
  const probabilityProblem = OPEN_STAGES.some((s) => {
    const v = Number(probabilityDraft[s]);
    return (probabilityDraft[s] ?? "").trim() === "" || !Number.isInteger(v) || v < 0 || v > 100;
  });
  const probabilitiesChanged = OPEN_STAGES.some((s) => Number(probabilityDraft[s]) !== settings.stageProbabilities?.[s]);
  const saveProbabilities = async () => {
    if (probabilityProblem) return;
    try {
      setSaving(true);
      await put({ stageProbabilities: Object.fromEntries(OPEN_STAGES.map((s) => [s, Number(probabilityDraft[s])])) });
      ToasterService.success(t("Stage probabilities saved"));
    } catch (err) {
      const message = apiError(err, "Failed to save the CRM settings");
      ToasterService.error(Object.values(fieldErrorOf(message))[0] || message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title={t("CRM Settings")} description="Your company's CRM rules" />
      <PageBreadcrumb pageTitle="CRM Settings" />

      <div className="w-full max-w-none space-y-4 px-3 py-4">
        <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              <EyeIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("Who sees which leads and deals")}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {t("Every lead and deal has an owner: the person who added it, unless someone else is picked.")}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={loading || saving || !settings.canChange}
            onClick={() => setOwnRecordsOnly(!on)}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-start transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-slate-200 dark:border-gray-700 dark:bg-white/[0.02]"
          >
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-gray-200">
                {t("Sales people see only their own leads and deals")}
              </span>
              <span className={`mt-0.5 block text-xs font-semibold ${on ? "text-emerald-600" : "text-slate-500"}`}>
                {loading ? t("Loading…") : t(on ? "On" : "Off: everyone in the CRM sees all leads and deals")}
              </span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}`} />
            </span>
          </button>

          {!loading && !settings.canChange && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t("Only a CRM admin can change this.")}</p>
          )}

          <div className="mt-5 text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium text-gray-800 dark:text-gray-100">{t("When it is on:")}</p>
            <ul className="mt-2 list-disc space-y-1.5 ps-5">
              <li>{t("People without the CRM admin right see the leads and deals they own, and unassigned ones anyone can take.")}</li>
              <li>{t("They see the tasks and interactions assigned to them, written by them, or on a lead they can see.")}</li>
              <li>{t("Tasks and interactions about a customer stay visible to everyone: customers are shared by the whole company.")}</li>
              <li>{t("The CRM dashboard and CRM reports count only what each person can see.")}</li>
              <li>{t("CRM admins always see everything.")}</li>
            </ul>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {t("Leads and deals added before owners existed are unassigned, so everyone keeps seeing them until someone becomes their owner.")}
            </p>
          </div>
        </section>

        <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              <BellAlertIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("Follow-up reminders")}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {t("The owner gets a reminder under the bell when a lead or an open deal goes quiet, and when a deal passes its expected close date. Everyone is reminded of their own tasks when they come due and when they become overdue.")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Remind after (days without a task or interaction)")}</span>
              <input
                type="number"
                min={0}
                max={365}
                value={idleDraft}
                disabled={loading || saving || !settings.canChange}
                onChange={(e) => setIdleDraft(e.target.value)}
                className="h-9 w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>
            {settings.canChange && (
              <button type="button" disabled={!idleValid || saving || idleValue === settings.idleDays} onClick={saveIdle}
                className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? t("Saving…") : t("Save")}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("0 turns these reminders off. A task still planned ahead counts as a follow-up. A deal's tasks and interactions are those on its lead or customer. Records without an owner aren't reminded.")}
          </p>
          {!idleValid && <p className="mt-1 text-xs text-rose-600">{t("Enter 0 to 365 days")}</p>}
        </section>

        <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              <ListBulletIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("Lists")}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {t("The choices on leads and deals. Removing an entry doesn't change the records that already have it.")}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <ListEditor
              title="Lead sources"
              help="Where leads come from; reports will compare them."
              items={settings.leadSources}
              standard={STANDARD_SOURCES}
              canChange={settings.canChange}
              onSave={saveList("leadSources")}
            />
            <ListEditor
              title="Lost reasons"
              help="Why leads and deals are lost; asked whenever one is marked Lost."
              items={settings.lostReasons}
              standard={STANDARD_REASONS}
              canChange={settings.canChange}
              onSave={saveList("lostReasons")}
            />
          </div>
        </section>

        <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              <ChartBarIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("Win probability by stage")}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {t("A deal takes its stage's probability when it moves there; it can be changed on the deal. The weighted pipeline is each open deal's amount × its probability.")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[...OPEN_STAGES, "WON", "LOST"].map((stage) => {
              const fixed = stage === "WON" || stage === "LOST";
              return (
                <label key={stage} className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t(STAGE_LABELS[stage])}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={fixed || !settings.canChange}
                      value={fixed ? (stage === "WON" ? 100 : 0) : probabilityDraft[stage] ?? ""}
                      onChange={(e) => setProbabilityDraft({ ...probabilityDraft, [stage]: e.target.value })}
                      aria-label={`${t(STAGE_LABELS[stage])} %`}
                      className="h-9 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-cyan-500 disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </label>
              );
            })}
          </div>
          {settings.canChange && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("Won is always 100% and Lost 0%.")}</p>
              <button type="button" disabled={probabilityProblem || !probabilitiesChanged || saving} onClick={saveProbabilities}
                className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
                {t("Save")}
              </button>
            </div>
          )}
          {probabilityProblem && settings.canChange && <p className="mt-1 text-xs text-rose-600">{t("Enter a whole number from 0 to 100 for each stage")}</p>}
        </section>
      </div>
    </>
  );
}
