import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import axios from "axios";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, apiError } from "./invoiceShared";
import { BANK_API, BankAccount } from "./bankShared";
import { t } from "../../i18n/i18n";

// Finance → Online payments (backlog 7.1.3): the company's payment gateway for pay-online links on invoices, in the
// customer portal and in payment reminders.

const API = `${INVOICE_API}/payment-gateway`;

interface Field { key: string; label: string; secret: boolean; required: boolean; hint: string; choices: string[] }
interface Provider { code: string; name: string; regions: string; fields: Field[] }
interface Gateway {
  provider: string | null;
  enabled: boolean;
  testMode: boolean;
  settings: Record<string, string>;
  secretsSet: string[];
  bankAccountId: number | null;
  providers: Provider[];
  keysCanBeStored: boolean;
  linksCanBeMade: boolean;
}

const INPUT =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";

export default function OnlinePayments() {
  const { access } = useContext(AuthContext);
  const canAdmin = access.superAdmin || hasPermission(access, "INVOICE:ADMIN");
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [provider, setProvider] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [bankAccountId, setBankAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = (g: Gateway) => {
    setGateway(g);
    setProvider(g.provider ?? "");
    setEnabled(g.provider ? g.enabled : true);
    setTestMode(g.testMode);
    setSettings(g.settings ?? {});
    setSecrets({});
    setBankAccountId(g.bankAccountId ? String(g.bankAccountId) : "");
  };

  useEffect(() => {
    axios.get<Gateway>(API).then((r) => load(r.data)).catch((err) => ToasterService.error(apiError(err, "Couldn't load the online payment settings")));
    axios.get<BankAccount[]>(BANK_API).then((r) => setBanks((r.data ?? []).filter((b) => b.kind === "BANK"))).catch(() => setBanks([]));
  }, []);

  const chosen = useMemo(() => gateway?.providers.find((p) => p.code === provider), [gateway, provider]);
  const editable = canAdmin;

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put<Gateway>(API, {
        provider, enabled, testMode, settings, secrets, bankAccountId: bankAccountId ? Number(bankAccountId) : null,
      });
      load(res.data);
      ToasterService.success(t(res.data.enabled ? "Online payments saved" : "Online payments switched off"));
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't save the online payment settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title={t("Online Payments")} description="Take card payments for invoices through your payment gateway" />
      <PageBreadcrumb pageTitle="Online Payments" />
      <div className="w-full max-w-none space-y-4 px-3 py-4">
        <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              <CreditCardIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("Payment gateway")}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {t("Customers pay an invoice by card through your own gateway account: from its pay link, the customer portal or a payment reminder. Each payment is checked with the gateway and recorded as a receipt against the invoice.")}
              </p>
            </div>
          </div>

          {gateway && !gateway.keysCanBeStored && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("Your server isn't set up to store payment keys yet (payments.secret). Ask your administrator.")}
            </p>
          )}
          {gateway && !gateway.linksCanBeMade && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("Pay links need the app's public address on the server (payments.public-url). Ask your administrator.")}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={LABEL}>{t("Gateway")}</span>
              <select className={INPUT} value={provider} disabled={!editable} onChange={(e) => { setProvider(e.target.value); setSettings({}); setSecrets({}); }}>
                <option value="">{t("Choose your gateway")}</option>
                {gateway?.providers.map((p) => <option key={p.code} value={p.code}>{p.name} — {p.regions}</option>)}
              </select>
            </label>
            {chosen?.fields.map((f) => (
              <label key={f.key} className="block">
                <span className={LABEL}>{t(f.label)}{f.required ? " *" : ""}</span>
                {f.choices.length > 0 ? (
                  <select className={INPUT} value={settings[f.key] ?? ""} disabled={!editable} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}>
                    <option value="">—</option>
                    {f.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input
                    dir="ltr"
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    className={INPUT}
                    disabled={!editable}
                    placeholder={f.secret && gateway?.provider === provider && gateway?.secretsSet.includes(f.key) ? t("Saved — type to replace") : ""}
                    value={f.secret ? secrets[f.key] ?? "" : settings[f.key] ?? ""}
                    onChange={(e) => (f.secret ? setSecrets({ ...secrets, [f.key]: e.target.value }) : setSettings({ ...settings, [f.key]: e.target.value }))}
                  />
                )}
                <span className="mt-1 block text-[11px] text-slate-500">{t(f.hint)}</span>
              </label>
            ))}
            {chosen && (
              <label className="block sm:col-span-2">
                <span className={LABEL}>{t("Payments go to")}</span>
                <select className={INPUT} value={bankAccountId} disabled={!editable} onChange={(e) => setBankAccountId(e.target.value)}>
                  <option value="">{t("The default bank account")}</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.accountName}{b.currency ? ` (${b.currency})` : ""}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">{t("The bank account the gateway pays out to: receipts from online payments are recorded there.")}</span>
              </label>
            )}
          </div>

          {chosen && (
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={enabled} disabled={!editable} onChange={(e) => setEnabled(e.target.checked)} />
                {t("Take payments online")}
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={testMode} disabled={!editable} onChange={(e) => setTestMode(e.target.checked)} />
                {t("Test mode (the gateway's sandbox; no real money)")}
              </label>
              {editable && (
                <button type="button" disabled={saving || !provider} onClick={save}
                  className="ms-auto h-10 rounded-lg bg-cyan-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">
                  {saving ? t("Saving…") : t("Save")}
                </button>
              )}
            </div>
          )}
          {!editable && <p className="mt-3 text-xs text-amber-700">{t("Only a finance administrator can change this.")}</p>}
        </section>

        <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
          <p className="font-medium text-gray-800 dark:text-gray-100">{t("How it works")}</p>
          <ul className="mt-2 list-disc space-y-1.5 ps-5">
            <li>{t("Open an issued invoice and click Pay link to get its address; send it any way you like. Payment reminders include it too.")}</li>
            <li>{t("The customer pays what is still due at that moment. A payment above what is due is kept as customer credit.")}</li>
            <li>{t("MyTrade asks the gateway whether each payment went through (it never relies on the customer coming back), and checks unfinished ones every few minutes.")}</li>
            <li>{t("Gateway fees are not recorded: post them from the payout statement.")}</li>
          </ul>
        </section>
      </div>
    </>
  );
}
