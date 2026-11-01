import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Ban, CheckCircle2, Mail, Plus } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { usePermissions } from "../../access/usePermissions";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const API = "/v1/api/user/portal-accounts";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 text-sm text-slate-700 dark:text-gray-200";

interface Account { userId: string; customerId: number; customerName: string | null; email: string; firstName: string; lastName: string; active: boolean; invitePending: boolean }
interface Customer { id: number; customerName?: string; customerCode?: string; active?: boolean }
type Form = { customerId: string; email: string; firstName: string; lastName: string };

/** Who at each customer can sign in to the customer portal. Invited by email; they see only their own company's account. */
export default function PortalAccounts() {
  const { canCreate, canUpdate } = usePermissions("USERS");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Account[]>(API).then((r) => setAccounts(Array.isArray(r.data) ? r.data : [])).catch((err) => {
      setAccounts([]);
      ToasterService.error("Portal accounts could not be loaded", errorText(err, "Please try again."));
    });
  }, []);

  useEffect(() => {
    load();
    axios.get("/v1/api/common/customers").then((r) => setCustomers(Array.isArray(r.data) ? r.data : r.data?.content ?? [])).catch(() => setCustomers([]));
  }, [load]);

  const save = async () => {
    if (!form) return;
    if (!form.customerId || !form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      ToasterService.error("Choose the customer and enter the contact's name and email.");
      return;
    }
    setBusy(true);
    try {
      const customer = customers.find((c) => String(c.id) === form.customerId);
      const { data } = await axios.post<{ account: Account; inviteSent: boolean }>(API, {
        customerId: Number(form.customerId), customerName: customer?.customerName ?? null, email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      });
      if (data.inviteSent) ToasterService.success(t("Invitation sent to {email}.", { email: data.account.email }));
      else ToasterService.warning("The account is ready but the email could not be sent", "Check the mail settings, then send the invitation again.");
      setForm(null);
      load();
    } catch (err) {
      ToasterService.error("The account could not be created", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const reinvite = async (a: Account) => {
    try {
      const { data } = await axios.post<{ inviteSent: boolean }>(`${API}/${a.userId}/invite`);
      if (data.inviteSent) ToasterService.success(t("Invitation sent to {email}.", { email: a.email }));
      else ToasterService.warning("The email could not be sent", "Check the mail settings.");
    } catch (err) {
      ToasterService.error("The email could not be sent", errorText(err, "Please try again."));
    }
  };

  const setActive = async (a: Account, active: boolean) => {
    if (!active && !window.confirm(t("Stop portal access for {email}?", { email: a.email }))) return;
    try {
      await axios.put(`${API}/${a.userId}/active`, { active });
      load();
    } catch (err) {
      ToasterService.error("The account could not be changed", errorText(err, "Please try again."));
    }
  };

  return (
    <>
      <PageMeta title={t("Customer Portal")} description="Who at each customer can see their account" />
      <PageBreadcrumb pageTitle="Customer Portal" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className={`${CARD} p-4 text-sm text-slate-600 dark:text-gray-300`}>
          {t("Invite a contact at a customer to see that customer's invoices, payments, credit notes and statement, and download the PDFs. They can't see anything else or change anything.")}
        </div>
        {form && (
          <div className={`${CARD} space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{t("Invite a contact")}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={LABEL} htmlFor="pa-customer">{t("Customer")}</label>
                <select id="pa-customer" className={INPUT} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">—</option>
                  {customers.filter((c) => c.active !== false).map((c) => <option key={c.id} value={c.id}>{c.customerName}{c.customerCode ? ` (${c.customerCode})` : ""}</option>)}
                </select>
              </div>
              <div><label className={LABEL} htmlFor="pa-first">{t("First name")}</label><input id="pa-first" className={INPUT} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="pa-last">{t("Last name")}</label><input id="pa-last" className={INPUT} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="pa-email">{t("Email")}</label><input id="pa-email" type="email" className={INPUT} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setForm(null)}>{t("Close")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}>{t("Send invitation")}</button>
            </div>
          </div>
        )}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <h2 className={CARD_TITLE}>{t("Portal accounts")}</h2>
            {canCreate && <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm({ customerId: "", email: "", firstName: "", lastName: "" })}><Plus className="h-4 w-4" /> {t("Invite a contact")}</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]"><tr>
                <th className={TH}>{t("Customer")}</th><th className={TH}>{t("Contact")}</th><th className={TH}>{t("Email")}</th><th className={TH}>{t("Status")}</th><th className={TH} aria-label={t("Actions")} />
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {accounts === null ? <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  : accounts.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("No portal accounts yet.")}</td></tr>
                  : accounts.map((a) => (
                    <tr key={a.userId}>
                      <td className={`${TD} font-medium`}>{a.customerName ?? `#${a.customerId}`}</td>
                      <td className={TD}>{a.firstName} {a.lastName}</td>
                      <td className={TD}>{a.email}</td>
                      <td className={TD}>{t(!a.active ? "Stopped" : a.invitePending ? "Invited" : "Active")}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        {canUpdate && a.active && a.invitePending && <button type="button" className={ROW_ICON_BUTTON} title={t("Send the invitation again")} aria-label={t("Send the invitation again")} onClick={() => void reinvite(a)}><Mail className="h-4 w-4" /></button>}
                        {canUpdate && (a.active
                          ? <button type="button" className={ROW_ICON_BUTTON} title={t("Stop access")} aria-label={t("Stop access")} onClick={() => void setActive(a, false)}><Ban className="h-4 w-4" /></button>
                          : <button type="button" className={ROW_ICON_BUTTON} title={t("Restore access")} aria-label={t("Restore access")} onClick={() => void setActive(a, true)}><CheckCircle2 className="h-4 w-4" /></button>)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
