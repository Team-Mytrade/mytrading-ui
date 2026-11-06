import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Check, Copy, History, KeyRound, Pause, Play, Plus, RotateCcw, Send, Trash2, Webhook } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

// Times from the server are UTC without a zone mark (like the audit log); shown in the company's zone
const utc = (value: string | null | undefined) => (value ? `${value}Z` : null);

const BASE = "/v1/api/user/company/webhooks";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Subscription {
  id: number; url: string; description: string | null; events: string[]; active: boolean; createdBy: string | null;
  createdAt: string; lastDeliveryAt: string | null; lastResult: string | null;
}
interface Delivery {
  id: number; eventId: string; eventType: string; status: "PENDING" | "DELIVERED" | "FAILED"; attempts: number; responseStatus: number | null;
  lastError: string | null; createdAt: string; lastAttemptAt: string | null; nextAttemptAt: string | null; deliveredAt: string | null;
}

// Event groups by their first word (sales_order.confirmed → Sales orders)
const GROUP: Record<string, string> = {
  sales_order: "Sales orders", dispatch: "Dispatches", sales_return: "Sales returns", pos: "Point of sale", invoice: "Invoices",
  credit_note: "Credit notes", payment: "Payments received", purchase_order: "Purchase orders", goods_receipt: "Goods receipts",
  customer: "Customers", product: "Products", stock: "Stock",
};
const STATUS_TONE: Record<string, string> = {
  DELIVERED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  FAILED: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
};

const VERIFY_EXAMPLE = `// Node.js: check MyTrade-Signature before trusting the call
const crypto = require("crypto");
function verify(rawBody, header, secret) {
  const t = /t=(\\d+)/.exec(header)[1], v1 = /v1=([0-9a-f]+)/.exec(header)[1];
  const expected = crypto.createHmac("sha256", secret).update(t + "." + rawBody).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return fresh && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`;

/**
 * Webhooks (backlog 7.2.4 step 2): another program's HTTPS address is called when chosen events happen — an order
 * confirmed, an invoice issued, a payment received… Each call is signed with the webhook's secret; failed calls are
 * retried for about a day, and every attempt is listed here.
 */
export default function WebhooksPage() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [form, setForm] = useState<{ id: number | null; url: string; description: string; events: string[] } | null>(null);
  const [secret, setSecret] = useState<{ url: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [log, setLog] = useState<Delivery[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Subscription[]>(BASE).then((r) => setSubs(r.data)).catch((err) => {
      setSubs([]);
      ToasterService.error(t("Webhooks could not be loaded"), apiError(err, t("Please try again.")));
    });
    axios.get<string[]>(`${BASE}/events`).then((r) => setEvents(r.data)).catch(() => setEvents([]));
  }, []);
  useEffect(load, [load]);

  const loadLog = useCallback((id: number) => {
    setLog(null);
    axios.get<Delivery[]>(`${BASE}/${id}/deliveries`).then((r) => setLog(r.data)).catch(() => setLog([]));
  }, []);
  useEffect(() => {
    if (open != null) loadLog(open);
  }, [open, loadLog]);

  const grouped = useMemo(() => {
    const groups = new Map<string, string[]>();
    events.forEach((e) => {
      const g = e.split(".")[0];
      groups.set(g, [...(groups.get(g) ?? []), e]);
    });
    return [...groups.entries()];
  }, [events]);

  const run = async (work: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await work();
      if (message) ToasterService.success(t(message));
      load();
      if (open != null) loadLog(open);
    } catch (err) {
      ToasterService.error(t("The webhook could not be saved"), apiError(err, t("Please try again.")));
    } finally {
      setBusy(false);
    }
  };

  const save = () => form && run(async () => {
    if (!form.url.trim() || form.events.length === 0) throw { response: { data: { message: t("Enter the address and tick at least one event.") } } };
    if (form.id) {
      await axios.put(`${BASE}/${form.id}`, { url: form.url.trim(), description: form.description || null, events: form.events });
    } else {
      const { data } = await axios.post<{ subscription: Subscription; secret: string }>(BASE, { url: form.url.trim(), description: form.description || null, events: form.events });
      setSecret({ url: data.subscription.url, secret: data.secret });
      setCopied(false);
    }
    setForm(null);
  }, form.id ? "Webhook saved." : undefined);

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.secret);
      setCopied(true);
    } catch {
      ToasterService.error(t("Copy it by hand: select the key and copy."));
    }
  };

  const remove = (s: Subscription) => {
    if (!window.confirm(t("Remove the webhook to {url}? Its delivery log goes too.", { url: s.url }))) return;
    run(() => axios.delete(`${BASE}/${s.id}`), "Webhook removed.");
    if (open === s.id) setOpen(null);
  };

  const rollSecret = (s: Subscription) => {
    if (!window.confirm(t("Make a new signing secret for {url}? The old one stops at once.", { url: s.url }))) return;
    run(async () => {
      const { data } = await axios.post<{ secret: string }>(`${BASE}/${s.id}/secret`);
      setSecret({ url: s.url, secret: data.secret });
      setCopied(false);
    });
  };

  return (
    <>
      <PageMeta title={t("Webhooks")} description="Calls to other programs when things happen" />
      <PageBreadcrumb pageTitle="Webhooks" />
      <div className={`${PAGE_BODY} space-y-4`}>
        {secret && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t("Signing secret for {url}", { url: secret.url })}</h2>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{t("Give it to the receiving program so it can check each call is from MyTrade. It is shown only now.")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-800 dark:bg-[#191919] dark:text-white" dir="ltr">{secret.secret}</code>
              <button type="button" className={SECONDARY_BUTTON} onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {t(copied ? "Copied" : "Copy")}</button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setSecret(null)}>{t("Done")}</button>
            </div>
          </section>
        )}

        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <h2 className={CARD_TITLE}>{t("Webhooks")}</h2>
            {!form && <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm({ id: null, url: "https://", description: "", events: [] })}><Plus className="h-4 w-4" /> {t("Add webhook")}</button>}
          </div>

          {form && (
            <div className="space-y-4 border-b border-slate-100 p-4 dark:border-gray-800">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="wh-url">{t("Address (https)")} *</label>
                  <input id="wh-url" className={INPUT} dir="ltr" maxLength={500} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="wh-desc">{t("Description")}</label>
                  <input id="wh-desc" className={INPUT} maxLength={200} placeholder={t("e.g. Web shop order sync")} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div>
                <span className={LABEL}>{t("Events")} *</span>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {grouped.map(([group, list]) => (
                    <div key={group} className="rounded-lg border border-slate-100 p-3 dark:border-gray-800">
                      <div className="mb-1.5 text-sm font-semibold text-slate-800 dark:text-gray-100">{t(GROUP[group] ?? group)}</div>
                      <div className="flex flex-col gap-1">
                        {list.map((e) => (
                          <label key={e} className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-gray-200" dir="ltr">
                            <input type="checkbox" checked={form.events.includes(e)}
                              onChange={() => setForm({ ...form, events: form.events.includes(e) ? form.events.filter((x) => x !== e) : [...form.events, e] })} />
                            <span className="font-mono">{e}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setForm(null)}>{t("Cancel")}</button>
                <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}><Webhook className="h-4 w-4" /> {t(form.id ? "Save" : "Add webhook")}</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]">
                <tr>
                  <th className={TH}>{t("Address")}</th>
                  <th className={TH}>{t("Events")}</th>
                  <th className={TH}>{t("Last call")}</th>
                  <th className={TH}>{t("Status")}</th>
                  <th className={TH} aria-label={t("Actions")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {subs === null ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                ) : subs.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("No webhooks yet.")}</td></tr>
                ) : subs.map((s) => (
                  <tr key={s.id} className={open === s.id ? "bg-slate-50/60 dark:bg-white/5" : ""}>
                    <td className={TD}>
                      <span className="break-all font-mono text-xs" dir="ltr">{s.url}</span>
                      {s.description && <span className="block text-xs text-slate-400">{s.description}</span>}
                    </td>
                    <td className={`${TD} font-mono text-[11px]`} dir="ltr">{s.events.join(", ")}</td>
                    <td className={`${TD} whitespace-nowrap text-xs`}>
                      {s.lastDeliveryAt ? <>{formatDateTime(utc(s.lastDeliveryAt))}<span className={`ms-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[s.lastResult ?? ""] ?? ""}`}>{t(s.lastResult === "DELIVERED" ? "Delivered" : "Failed")}</span></> : t("Never")}
                    </td>
                    <td className={TD}>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.active ? STATUS_TONE.DELIVERED : "bg-slate-100 text-slate-600"}`}>{t(s.active ? "Active" : "Paused")}</span>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-end`}>
                      <button type="button" className={ROW_ICON_BUTTON} title={t("Send a test")} aria-label={t("Send a test")} disabled={busy}
                        onClick={() => run(() => axios.post(`${BASE}/${s.id}/ping`), "Test queued: it is sent within a few seconds.")}><Send className="h-4 w-4" /></button>
                      <button type="button" className={ROW_ICON_BUTTON} title={t("Delivery log")} aria-label={t("Delivery log")} onClick={() => setOpen(open === s.id ? null : s.id)}><History className="h-4 w-4" /></button>
                      <button type="button" className={ROW_ICON_BUTTON} title={t(s.active ? "Pause" : "Resume")} aria-label={t(s.active ? "Pause" : "Resume")} disabled={busy}
                        onClick={() => run(() => axios.put(`${BASE}/${s.id}`, { url: s.url, description: s.description, events: s.events, active: !s.active }))}>
                        {s.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")}
                        onClick={() => setForm({ id: s.id, url: s.url, description: s.description ?? "", events: s.events })}><Webhook className="h-4 w-4" /></button>
                      <button type="button" className={ROW_ICON_BUTTON} title={t("New signing secret")} aria-label={t("New signing secret")} onClick={() => rollSecret(s)}><KeyRound className="h-4 w-4" /></button>
                      <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")} onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {open != null && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <h2 className={CARD_TITLE}>{t("Delivery log")} · <span className="font-mono text-xs" dir="ltr">{subs?.find((s) => s.id === open)?.url}</span></h2>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => loadLog(open)}>{t("Refresh")}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Event")}</th>
                    <th className={TH}>{t("Status")}</th>
                    <th className={TH}>{t("Attempts")}</th>
                    <th className={TH}>{t("Answer")}</th>
                    <th className={TH}>{t("Last try")}</th>
                    <th className={TH}>{t("Next try")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {log === null ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : log.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">{t("Nothing sent yet.")}</td></tr>
                  ) : log.map((d) => (
                    <tr key={d.id}>
                      <td className={TD}><span className="font-mono text-xs" dir="ltr">{d.eventType}</span><span className="block font-mono text-[10px] text-slate-400" dir="ltr">{d.eventId}</span></td>
                      <td className={TD}><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[d.status]}`}>{t(d.status === "DELIVERED" ? "Delivered" : d.status === "PENDING" ? "Waiting" : "Failed")}</span></td>
                      <td className={TD}>{d.attempts}</td>
                      <td className={`${TD} text-xs`}>{d.responseStatus ?? "—"}{d.lastError && <span className="block max-w-xs truncate text-red-600" title={d.lastError}>{d.lastError}</span>}</td>
                      <td className={`${TD} whitespace-nowrap text-xs`}>{d.lastAttemptAt ? formatDateTime(utc(d.lastAttemptAt)) : "—"}</td>
                      <td className={`${TD} whitespace-nowrap text-xs`}>{d.status === "PENDING" && d.nextAttemptAt ? formatDateTime(utc(d.nextAttemptAt)) : "—"}</td>
                      <td className={`${TD} text-end`}>
                        {d.status !== "PENDING" && (
                          <button type="button" className={ROW_ICON_BUTTON} title={t("Send again")} aria-label={t("Send again")} disabled={busy}
                            onClick={() => run(() => axios.post(`${BASE}/deliveries/${d.id}/resend`), "Queued to send again.")}><RotateCcw className="h-4 w-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <section className={`${CARD} space-y-3 p-4`}>
          <h2 className={CARD_TITLE}>{t("For developers")}</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm text-slate-700 dark:text-gray-200">
            <li>{t("Each call is a POST with JSON {id, type, createdAt, companyId, data: {object, id, reference, summary}}. Read the full record through the API with an API key.")}</li>
            <li>{t("Answer with any 2xx within 10 seconds. Anything else is tried again after 1, 5 and 15 minutes, then 1, 3, 6 and 12 hours.")}</li>
            <li>{t("MyTrade-Delivery is the event id, the same on every retry: ignore one you have already handled.")}</li>
            <li>{t("MyTrade-Signature is t=<seconds>,v1=<HMAC-SHA256 of \"t.body\" with the secret>. Check it before trusting the call:")}</li>
          </ul>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100" dir="ltr">{VERIFY_EXAMPLE}</pre>
        </section>
      </div>
    </>
  );
}
