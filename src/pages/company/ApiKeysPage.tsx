import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Check, Copy, KeyRound, Plus, ShieldOff } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { formatDate, formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const BASE = "/v1/api/user/company/api-keys";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  permissions: string[];
  expiresOn: string | null;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

const MODULE_LABEL: Record<string, string> = {
  PRODUCT_CATALOGUE: "Products", CRM: "Customers (CRM)", SALES: "Sales", PURCHASE: "Purchase", INVENTORY: "Inventory",
  INVOICE: "Finance", DELIVERY: "Delivery", HRM: "HR & payroll", ATTENDANCE: "Attendance",
};
const ACTION_ORDER = ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT"];
const TONE: Record<ApiKey["status"], string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  REVOKED: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  EXPIRED: "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300",
};

/** The public API's addresses as seen from outside (the gateway). */
const API_ROOT = typeof window !== "undefined" ? window.location.origin : "";

// The main endpoints an integration starts with (all existing service endpoints; the key's permissions decide)
const ENDPOINTS: [string, string, string][] = [
  ["GET", "/v1/api/common/products", "Products, prices and tax codes"],
  ["GET", "/v1/api/inventory/stock-levels", "Stock by warehouse"],
  ["GET", "/v1/api/common/customers", "Customers"],
  ["POST", "/v1/api/common/customers", "Add a customer"],
  ["GET", "/v1/api/sales/sales-orders", "Sales orders"],
  ["POST", "/v1/api/sales/sales-orders", "Place a sales order"],
  ["GET", "/v1/api/invoice/invoices", "Invoices and what is still owed"],
  ["GET", "/v1/api/invoice/payment-receipts", "Payments received"],
  ["GET", "/v1/api/purchase/purchase-orders", "Purchase orders"],
  ["GET", "/v1/api/user/company", "The company's details"],
];

/**
 * API keys (backlog 7.2.4 step 1): company administrators give another program — a web shop, a reporting tool, an
 * integration partner — its own key with only the rights it needs. The program trades the key for a 15-minute access
 * token and calls the usual endpoints; revoking the key stops it.
 */
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [grantable, setGrantable] = useState<string[]>([]);
  const [form, setForm] = useState<{ name: string; expiresOn: string; permissions: string[] } | null>(null);
  const [made, setMade] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  const load = useCallback(() => {
    axios.get<ApiKey[]>(BASE).then((r) => setKeys(r.data)).catch((err) => {
      setKeys([]);
      ToasterService.error(t("API keys could not be loaded"), apiError(err, t("Please try again.")));
    });
    axios.get<string[]>(`${BASE}/permissions`).then((r) => setGrantable(r.data)).catch(() => setGrantable([]));
  }, []);
  useEffect(load, [load]);

  // What may be given, by module
  const byModule = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const code of grantable) {
      const [module, action] = code.split(":");
      groups.set(module, [...(groups.get(module) ?? []), action]);
    }
    groups.forEach((actions) => actions.sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b)));
    return [...groups.entries()];
  }, [grantable]);

  const toggle = (code: string) => setForm((f) => (f ? { ...f, permissions: f.permissions.includes(code)
    ? f.permissions.filter((c) => c !== code) : [...f.permissions, code] } : f));

  const create = async () => {
    if (!form) return;
    if (!form.name.trim() || form.permissions.length === 0) {
      ToasterService.error(t("Name the key and tick what it may do."));
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post<{ client: ApiKey; apiKey: string }>(BASE, {
        name: form.name.trim(), permissions: form.permissions, expiresOn: form.expiresOn || null });
      setMade({ name: data.client.name, key: data.apiKey });
      setCopied(false);
      setForm(null);
      load();
    } catch (err) {
      ToasterService.error(t("The API key could not be made"), apiError(err, t("Please try again.")));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: ApiKey) => {
    if (!window.confirm(t("Revoke \"{name}\"? Programs using it stop working within 15 minutes.", { name: key.name }))) return;
    try {
      await axios.post(`${BASE}/${key.id}/revoke`);
      ToasterService.success(t("API key revoked."));
      load();
    } catch (err) {
      ToasterService.error(t("The API key could not be revoked"), apiError(err, t("Please try again.")));
    }
  };

  const copy = async () => {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(made.key);
      setCopied(true);
    } catch {
      ToasterService.error(t("Copy it by hand: select the key and copy."));
    }
  };

  const visible = (keys ?? []).filter((k) => showRevoked || k.status !== "REVOKED");
  const tokenExample = `curl -X POST ${API_ROOT}/v1/api/auth/token \\\n  -H "Content-Type: application/json" \\\n  -d '{"apiKey": "mtk_…"}'`;
  const callExample = `curl ${API_ROOT}/v1/api/inventory/stock-levels \\\n  -H "Authorization: Bearer <access_token>"`;

  return (
    <>
      <PageMeta title={t("API keys")} description="Keys for other programs to use the company's data" />
      <PageBreadcrumb pageTitle="API keys" />
      <div className={`${PAGE_BODY} space-y-4`}>
        {made && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t("Copy the key for \"{name}\" now", { name: made.name })}</h2>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{t("It is shown only this once. Keep it like a password: anyone with it can do what the key allows.")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-800 dark:bg-[#191919] dark:text-white" dir="ltr">{made.key}</code>
              <button type="button" className={SECONDARY_BUTTON} onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {t(copied ? "Copied" : "Copy")}</button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setMade(null)}>{t("Done")}</button>
            </div>
          </section>
        )}

        <div className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <h2 className={CARD_TITLE}>{t("API keys")}</h2>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)} /> {t("Show revoked")}
              </label>
            </div>
            {!form && <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm({ name: "", expiresOn: "", permissions: [] })}><Plus className="h-4 w-4" /> {t("New API key")}</button>}
          </div>

          {form && (
            <div className="space-y-4 border-b border-slate-100 p-4 dark:border-gray-800">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="ak-name">{t("Name (the program that uses it)")} *</label>
                  <input id="ak-name" className={INPUT} maxLength={80} placeholder={t("e.g. Web shop, Power BI, Shopify")} value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="ak-expiry">{t("Expires on")}</label>
                  <input id="ak-expiry" type="date" className={INPUT} value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
                  <p className="mt-1 text-[11px] text-slate-500">{t("Leave empty to keep it until it is revoked.")}</p>
                </div>
              </div>
              <div>
                <span className={LABEL}>{t("What it may do")} *</span>
                {byModule.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("You have no permissions you may give to a key.")}</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {byModule.map(([module, actions]) => (
                      <div key={module} className="rounded-lg border border-slate-100 p-3 dark:border-gray-800">
                        <div className="mb-1.5 text-sm font-semibold text-slate-800 dark:text-gray-100">{t(MODULE_LABEL[module] ?? module)}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {actions.map((action) => {
                            const code = `${module}:${action}`;
                            return (
                              <label key={code} className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-gray-200">
                                <input type="checkbox" checked={form.permissions.includes(code)} onChange={() => toggle(code)} /> {t(action.charAt(0) + action.slice(1).toLowerCase())}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-500">{t("Only what you may grant yourself. User administration and ADMIN rights stay with people.")}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setForm(null)}>{t("Cancel")}</button>
                <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={create}><KeyRound className="h-4 w-4" /> {t("Make the key")}</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]">
                <tr>
                  <th className={TH}>{t("Name")}</th>
                  <th className={TH}>{t("Key")}</th>
                  <th className={TH}>{t("May do")}</th>
                  <th className={TH}>{t("Last used")}</th>
                  <th className={TH}>{t("Status")}</th>
                  <th className={TH} aria-label={t("Actions")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {keys === null ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">{t("No API keys yet.")}</td></tr>
                ) : visible.map((k) => (
                  <tr key={k.id}>
                    <td className={TD}>
                      <span className="font-medium">{k.name}</span>
                      <span className="block text-xs text-slate-400">{t("By {who} on {date}", { who: k.createdBy ?? "—", date: formatDate(k.createdAt) })}</span>
                    </td>
                    <td className={`${TD} font-mono text-xs`} dir="ltr">{k.keyPrefix}_…</td>
                    <td className={`${TD} text-xs`}>{k.permissions.join(", ")}</td>
                    <td className={`${TD} whitespace-nowrap text-xs`}>{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : t("Never")}</td>
                    <td className={TD}>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[k.status]}`}>{t(k.status === "ACTIVE" ? "Active" : k.status === "REVOKED" ? "Revoked" : "Expired")}</span>
                      {k.expiresOn && k.status === "ACTIVE" && <span className="block text-[11px] text-slate-400">{t("Until {date}", { date: formatDate(k.expiresOn) })}</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-end`}>
                      {k.status !== "REVOKED" && (
                        <button type="button" className={SECONDARY_BUTTON} onClick={() => revoke(k)}><ShieldOff className="h-4 w-4" /> {t("Revoke")}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <section className={`${CARD} space-y-3 p-4`}>
          <h2 className={CARD_TITLE}>{t("For developers")}</h2>
          <ol className="list-decimal space-y-3 ps-5 text-sm text-slate-700 dark:text-gray-200">
            <li>
              {t("Trade the key for an access token (valid 15 minutes; ask again when it runs out):")}
              <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100" dir="ltr">{tokenExample}</pre>
              <span className="text-xs text-slate-500">{t("The answer is {access_token, token_type: \"Bearer\", expires_in}. A wrong, revoked or expired key gets 401.")}</span>
            </li>
            <li>
              {t("Call the API with the token:")}
              <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100" dir="ltr">{callExample}</pre>
              <span className="text-xs text-slate-500">{t("Each call is checked against the key's permissions: without them the answer is 403.")}</span>
            </li>
          </ol>
          <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
            <table className="w-full min-w-[36rem] divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]"><tr><th className={TH}>{t("Method")}</th><th className={TH}>{t("Address")}</th><th className={TH}>{t("What")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {ENDPOINTS.map(([method, path, what]) => (
                  <tr key={method + path}>
                    <td className={`${TD} font-mono text-xs`}>{method}</td>
                    <td className={`${TD} font-mono text-xs`} dir="ltr">{path}</td>
                    <td className={TD}>{t(what)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">{t("Keys never reach people's accounts, sign-in or notifications. Revoked keys get no new tokens; tokens already given end within 15 minutes.")}</p>
        </section>
      </div>
    </>
  );
}
