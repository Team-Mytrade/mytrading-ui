import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { Pencil, Plus } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { CostCentre, INVOICE_API, apiError } from "./invoiceShared";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const API_URL = `${INVOICE_API}/cost-centres`;
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 text-sm text-slate-700 dark:text-gray-200";

type Form = { id: number | null; code: string; name: string; description: string; active: boolean };

/**
 * Branches, departments or projects that income and expense lines are reported by. They are chosen on journal lines
 * and bills, and Financial Statements shows the profit and loss per cost centre. INVOICE:ADMIN changes them.
 */
export default function CostCentres() {
  const { access } = useContext(AuthContext);
  const editable = hasPermission(access, "INVOICE:ADMIN");
  const [centres, setCentres] = useState<CostCentre[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<CostCentre[]>(API_URL).then((r) => setCentres(Array.isArray(r.data) ? r.data : [])).catch((err) => {
      setCentres([]);
      ToasterService.error(apiError(err, "Failed to load cost centres"));
    });
  }, []);

  useEffect(load, [load]);

  const save = async () => {
    if (!form) return;
    if (!form.code.trim() || !form.name.trim()) {
      ToasterService.error("Enter the code and the name.");
      return;
    }
    setBusy(true);
    try {
      const body = { code: form.code, name: form.name, description: form.description || null, active: form.active };
      await (form.id ? axios.put(`${API_URL}/${form.id}`, body) : axios.post(API_URL, body));
      ToasterService.success("Cost centre saved.");
      setForm(null);
      load();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the cost centre"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageMeta title={t("Cost Centres")} description="Report income and expenses by branch, department or project" />
      <PageBreadcrumb pageTitle="Cost Centres" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className={`${CARD} p-4 text-sm text-slate-600 dark:text-gray-300`}>
          {t("Choose a cost centre on journal lines and bills, then read the profit and loss per cost centre in Financial Statements. Only income and expense lines carry one.")}
        </div>

        {form && (
          <div className={`${CARD} space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{form.id ? t("Edit cost centre") : t("New cost centre")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="cc-code">{t("Code")}</label>
                <input id="cc-code" className={INPUT} value={form.code} maxLength={30} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="cc-name">{t("Name")}</label>
                <input id="cc-name" className={INPUT} value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="cc-description">{t("Description")}</label>
                <input id="cc-description" className={INPUT} value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {t("Active (can be chosen on new postings)")}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setForm(null)}>{t("Close")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}>{t("Save")}</button>
            </div>
          </div>
        )}

        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <h2 className={CARD_TITLE}>{t("Cost Centres")}</h2>
            {editable && (
              <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm({ id: null, code: "", name: "", description: "", active: true })}>
                <Plus className="h-4 w-4" /> {t("New cost centre")}
              </button>
            )}
          </div>
          <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
            <thead className="bg-slate-50 dark:bg-[#222222]">
              <tr>
                <th className={TH}>{t("Code")}</th>
                <th className={TH}>{t("Name")}</th>
                <th className={TH}>{t("Description")}</th>
                <th className={TH}>{t("Status")}</th>
                <th className={TH} aria-label={t("Actions")} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {centres === null ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
              ) : centres.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("No cost centres yet.")}</td></tr>
              ) : centres.map((c) => (
                <tr key={c.id}>
                  <td className={`${TD} font-medium`}>{c.code}</td>
                  <td className={TD}>{c.name}</td>
                  <td className={TD}>{c.description ?? "—"}</td>
                  <td className={TD}>{t(c.active ? "Active" : "Inactive")}</td>
                  <td className={`${TD} text-end`}>
                    {editable && (
                      <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")}
                        onClick={() => setForm({ id: c.id, code: c.code, name: c.name, description: c.description ?? "", active: c.active })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
