import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Hash, Link2, Mail, MessageCircle, MessageSquareText, Save, Send, Users, XCircle } from "lucide-react";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import {
  ChannelDefinition, ChannelDelivery, ChannelOverview, ChannelState, notificationsApi,
} from "../../notifications/notificationsApi";
import { ADD_BUTTON_COLORS } from "../../components/common/AddButton";
import { formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, TOOL_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const HINT = "mt-1 text-[11px] text-slate-500 dark:text-gray-400";

const CATEGORY_LABELS: Record<string, string> = {
  APPROVAL: "Approvals", STOCK: "Stock", INVOICE: "Invoices", PAYMENT: "Payments", SYSTEM: "System",
  REMINDER: "Reminders", DELIVERY: "Deliveries",
};
const PRIORITY_LABELS: Record<string, string> = { LOW: "All alerts", MEDIUM: "Medium and high", HIGH: "High only" };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  IN_APP: Bell, EMAIL: Mail, SMS: MessageSquareText, WHATSAPP: MessageCircle, SLACK: Hash, TEAMS: Users, WEBHOOK: Link2,
};

interface Draft {
  enabled: boolean;
  provider: string;
  settings: Record<string, string>;
  secrets: Record<string, string>;
  categories: string[];
  minPriority: string;
}

const draftOf = (state: ChannelState): Draft => ({
  enabled: state.enabled, provider: state.provider, settings: { ...state.settings }, secrets: {},
  categories: [...state.categories], minPriority: state.minPriority,
});

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${checked ? "bg-cyan-600" : "bg-slate-300 dark:bg-gray-600"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** One channel: switch, provider, its settings, which alerts and from what priority; save and test. */
function ChannelCard({ definition, state, categories, priorities, editable, secretsConfigured, onSaved }: {
  definition: ChannelDefinition; state: ChannelState; categories: string[]; priorities: string[]; editable: boolean;
  secretsConfigured: boolean; onSaved: (next: ChannelState) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(state));
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  useEffect(() => setDraft(draftOf(state)), [state]);

  const Icon = ICONS[definition.code] ?? Bell;
  const provider = definition.providers.find((p) => p.code === draft.provider) ?? definition.providers[0];
  const dirty = !same(draft, draftOf(state));
  const needsSecrets = provider.fields.some((f) => f.secret);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy("save");
    try {
      const next = await notificationsApi.saveChannel(definition.code, draft);
      onSaved(next);
      ToasterService.success(`${t(definition.name)}: ${t(next.enabled ? "on" : "off")}.`);
    } catch (err) {
      ToasterService.error(`${t(definition.name)} could not be saved`, errorText(err, "Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const result = await notificationsApi.testChannel(definition.code);
      if (result.sent) {
        ToasterService.success(t("Test sent."), result.detail ?? undefined);
      } else {
        ToasterService.error(t("The test didn't go through"), result.detail ?? undefined);
      }
      const overview = await notificationsApi.channels();
      const fresh = overview.channels.find((c) => c.channel === definition.code);
      if (fresh) onSaved(fresh);
    } catch (err) {
      ToasterService.error(t("The test didn't go through"), errorText(err, "Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const testOk = state.lastTestResult?.startsWith("Sent");

  return (
    <div className={`rounded-xl border p-4 transition-colors ${draft.enabled ? "border-cyan-200 bg-cyan-50/30 dark:border-cyan-900/60 dark:bg-cyan-950/10" : "border-slate-200 dark:border-gray-800"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${draft.enabled ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300" : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t(definition.name)}</p>
            <Switch checked={draft.enabled} disabled={!editable} label={t(definition.name)} onChange={(v) => set({ enabled: v })} />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">{t(definition.description)}</p>
        </div>
      </div>

      {draft.enabled && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-gray-800">
          {definition.providers.length > 1 && (
            <div>
              <label className={LABEL} htmlFor={`ch-${definition.code}-provider`}>{t("Provider")}</label>
              <select id={`ch-${definition.code}-provider`} className={INPUT} value={draft.provider} disabled={!editable}
                onChange={(e) => set({ provider: e.target.value, settings: {}, secrets: {} })}>
                {definition.providers.map((p) => <option key={p.code} value={p.code}>{t(p.name)}</option>)}
              </select>
            </div>
          )}
          {provider.hint && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-gray-800/60 dark:text-gray-300">{t(provider.hint)}</p>}
          {needsSecrets && !secretsConfigured && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              {t("The server can't store keys yet: ask your MyTrade administrator to set notifications.secret.")}
            </p>
          )}

          {provider.fields.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {provider.fields.map((f) => {
                const id = `ch-${definition.code}-${f.key}`;
                const stored = f.secret && state.provider === draft.provider && state.secretsSet.includes(f.key);
                const value = f.secret ? draft.secrets[f.key] ?? "" : draft.settings[f.key] ?? "";
                const change = (v: string) => (f.secret
                  ? set({ secrets: { ...draft.secrets, [f.key]: v } })
                  : set({ settings: { ...draft.settings, [f.key]: v } }));
                return (
                  <div key={f.key} className={f.kind === "url" ? "md:col-span-2" : ""}>
                    <label className={LABEL} htmlFor={id}>{t(f.label)}{f.required && !stored ? " *" : ""}</label>
                    {f.kind === "select" ? (
                      <select id={id} className={INPUT} value={value || f.options[0]} disabled={!editable} onChange={(e) => change(e.target.value)}>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input id={id} className={INPUT} disabled={!editable} value={value} autoComplete="off"
                        type={f.secret ? "password" : f.kind === "number" ? "number" : f.kind === "email" ? "email" : "text"}
                        placeholder={stored ? t("Saved — leave empty to keep") : f.hint}
                        onChange={(e) => change(e.target.value)} />
                    )}
                    {f.hint && (stored || f.kind === "select") && <p className={HINT}>{t(f.hint)}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className={LABEL}>{t("Which alerts")}</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = draft.categories.includes(c);
                return (
                  <button key={c} type="button" disabled={!editable} aria-pressed={on}
                    onClick={() => set({ categories: on ? draft.categories.filter((x) => x !== c) : [...draft.categories, c] })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${on
                      ? "border-cyan-600 bg-cyan-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 dark:border-gray-700 dark:bg-transparent dark:text-gray-300"}`}>
                    {t(CATEGORY_LABELS[c] ?? c)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor={`ch-${definition.code}-priority`}>{t("Send")}</label>
              <select id={`ch-${definition.code}-priority`} className={INPUT} value={draft.minPriority} disabled={!editable}
                onChange={(e) => set({ minPriority: e.target.value })}>
                {priorities.map((p) => <option key={p} value={p}>{t(PRIORITY_LABELS[p] ?? p)}</option>)}
              </select>
              {(definition.code === "SMS" || definition.code === "WHATSAPP") && <p className={HINT}>{t("Each message is charged by your provider.")}</p>}
            </div>
            {definition.perPerson && definition.code !== "IN_APP" && (
              <p className={`${HINT} self-end`}>
                {t(definition.code === "EMAIL"
                  ? "Goes to the email address on each person's user (unless they turned notification emails off)."
                  : "Goes to the mobile number on each person's user (Settings → Users).")}
              </p>
            )}
          </div>
        </div>
      )}

      {(editable || state.lastTestResult) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-gray-400">
            {state.lastTestResult && (
              <>
                {testOk ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-600" />}
                <span>{t("Last test")} {state.lastTestAt ? formatDateTime(state.lastTestAt) : ""}: {state.lastTestResult}</span>
              </>
            )}
          </p>
          {editable && (
            <div className="flex gap-2">
              {definition.code !== "IN_APP" && state.saved && state.enabled && (
                <button type="button" className={TOOL_BUTTON} disabled={busy !== null || dirty} onClick={test}
                  title={dirty ? t("Save first, then send a test") : undefined}>
                  <Send className="h-3.5 w-3.5" /> {t(busy === "test" ? "Sending..." : "Send test")}
                </button>
              )}
              <button type="button" className={`${TOOL_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={busy !== null || !dirty} onClick={save}>
                <Save className="h-3.5 w-3.5" /> {t(busy === "save" ? "Saving..." : "Save")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The company's alert channels: each switched on or off on its own, with its provider and which alerts it carries.
 * Shown to Tenant Administrators (the service refuses everyone else).
 */
export default function AlertChannels({ editable }: { editable: boolean }) {
  const [overview, setOverview] = useState<ChannelOverview | null>(null);
  const [deliveries, setDeliveries] = useState<ChannelDelivery[]>([]);
  const [failed, setFailed] = useState(false);

  const loadDeliveries = () => notificationsApi.deliveries().then(setDeliveries, () => setDeliveries([]));
  useEffect(() => {
    notificationsApi.channels().then(setOverview, () => setFailed(true));
    loadDeliveries();
  }, []);

  const states = useMemo(() => new Map(overview?.channels.map((c) => [c.channel, c]) ?? []), [overview]);
  const onSaved = (next: ChannelState) => {
    setOverview((o) => o && { ...o, channels: o.channels.map((c) => (c.channel === next.channel ? next : c)) });
    loadDeliveries();
  };
  const on = overview?.channels.filter((c) => c.enabled).length ?? 0;

  return (
    <section className={`${CARD} p-5`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className={`${CARD_TITLE} flex items-center gap-2`}>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
            <Send className="h-4 w-4" />
          </span>
          {t("Alert channels")}
        </h3>
        {overview && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">{on} {t("of")} {overview.channels.length} {t("on")}</span>}
      </div>
      <p className="mb-4 text-xs text-slate-600 dark:text-gray-300">
        {t("Each alert goes to the people who can act on it, on every channel switched on for that kind of alert. A channel that fails never stops the others.")}
      </p>
      {failed && <p className="text-sm text-rose-600">{t("The channels could not be loaded. Only a Tenant Administrator can see them.")}</p>}
      {overview && (
        <div className="grid gap-3 xl:grid-cols-2">
          {overview.catalog.channels.map((definition) => {
            const state = states.get(definition.code);
            return state ? (
              <ChannelCard key={definition.code} definition={definition} state={state} categories={overview.catalog.categories}
                priorities={overview.catalog.priorities} editable={editable} secretsConfigured={overview.catalog.secretsConfigured}
                onSaved={onSaved} />
            ) : null;
          })}
        </div>
      )}

      {deliveries.length > 0 && (
        <div className="mt-5">
          <p className={`${LABEL} mb-2`}>{t("Recent deliveries")}</p>
          <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2">{t("When")}</th>
                  <th className="px-3 py-2">{t("Channel")}</th>
                  <th className="px-3 py-2">{t("To")}</th>
                  <th className="px-3 py-2">{t("Status")}</th>
                  <th className="px-3 py-2">{t("Details")}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.slice(0, 10).map((d, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-gray-800">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{d.at ? formatDateTime(d.at) : ""}</td>
                    <td className="px-3 py-2">{d.channel}</td>
                    <td className="px-3 py-2">{d.recipient}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.status === "SENT" ? "bg-emerald-50 text-emerald-700"
                        : d.status === "RETRYING" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                        {t(d.status === "SENT" ? "Sent" : d.status === "RETRYING" ? "Retrying" : "Failed")}
                      </span>
                    </td>
                    <td className="max-w-[28rem] truncate px-3 py-2 text-slate-500" title={d.detail ?? ""}>{d.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
