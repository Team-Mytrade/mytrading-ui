import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { companyCurrency, formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";
interface Limits {
  ownApprovalLimit?: number | null;
  secondApprovalLimit?: number | null;
  updatedBy?: string | null;
  updatedOn?: string | null;
}

const API = "/v1/api/purchase/approval-settings";
const INPUT =
  "w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

/**
 * Purchase order approval limits in the company's currency. Above the own-approval limit the buyer who raised an
 * order can't approve it; above the second-approval limit two different people must. Empty means no limit.
 */
export default function ApprovalLimits() {
  const { access } = useContext(AuthContext);
  const editable = hasPermission(access, "PURCHASE:ADMIN");
  const [limits, setLimits] = useState<Limits | null>(null);
  const [own, setOwn] = useState("");
  const [second, setSecond] = useState("");
  const [saving, setSaving] = useState(false);
  const currency = companyCurrency();

  useEffect(() => {
    axios.get<Limits>(API).then(
      (res) => {
        setLimits(res.data);
        setOwn(res.data.ownApprovalLimit != null ? String(res.data.ownApprovalLimit) : "");
        setSecond(res.data.secondApprovalLimit != null ? String(res.data.secondApprovalLimit) : "");
      },
      (err) => ToasterService.error(errorText(err, "Could not load the approval limits")),
    );
  }, []);

  const save = async () => {
    const ownValue = own.trim() === "" ? null : Number(own);
    const secondValue = second.trim() === "" ? null : Number(second);
    if ((ownValue != null && (isNaN(ownValue) || ownValue < 0)) || (secondValue != null && (isNaN(secondValue) || secondValue < 0))) {
      return ToasterService.error("Limits are amounts of 0 or more, or empty for no limit");
    }
    setSaving(true);
    try {
      const { data } = await axios.put<Limits>(API, { ownApprovalLimit: ownValue, secondApprovalLimit: secondValue });
      setLimits(data);
      ToasterService.success("Approval limits saved");
    } catch (err) {
      ToasterService.error(errorText(err, "Could not save the approval limits"));
    } finally {
      setSaving(false);
    }
  };

  const row = (label: string, help: string, value: string, set: (v: string) => void) => (
    <div className="grid gap-2 py-3 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-gray-100">{t(label)}</p>
        <p className="text-[11px] text-slate-500 dark:text-gray-400">{t(help)}</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="number" min={0} className={INPUT} value={value} disabled={!editable} placeholder={t("No limit")} aria-label={t(label)}
          onChange={(e) => set(e.target.value)} />
        {currency}
      </label>
    </div>
  );

  return (
    <>
      <PageMeta title={t("Approval Limits")} description="Who may approve purchase orders, by amount" />
      <PageBreadcrumb pageTitle="Approval Limits" />
      <div className={PAGE_BODY}>
        <section className={`${CARD} p-5`}>
          <h3 className={`${CARD_TITLE} mb-2 flex items-center gap-2`}>
            <ShieldCheckIcon className="h-4 w-4 text-cyan-600" /> {t("Purchase order approval limits")}
          </h3>
          <p className="mb-2 text-xs text-slate-600 dark:text-gray-300">
            {t("Orders are measured by their total in the company's currency, at the exchange rate on the order date. Leave a limit empty for no limit: then anyone allowed to approve purchase orders approves any order, as before.")}
            {!editable && ` ${t("Only a purchase administrator can change them.")}`}
          </p>
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
            {row("Own-approval limit", "Above this, the buyer who raised an order can't approve it themselves; someone else with approval rights must.", own, setOwn)}
            {row("Second-approval limit", "Above this, two different people must approve an order (neither of them the buyer). After the first it shows \"1 of 2 approved\"; changing the order starts the approvals over.", second, setSecond)}
          </div>
          {editable && (
            <div className="mt-3 flex items-center gap-3">
              <button type="button" disabled={saving} onClick={() => void save()}
                className="h-[38px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                {t(saving ? "Saving..." : "Save limits")}
              </button>
              {limits?.updatedOn && (
                <span className="text-[11px] text-slate-400">{t("Last changed")} {formatDateTime(limits.updatedOn)} · {limits.updatedBy}</span>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
