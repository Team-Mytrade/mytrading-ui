import { useEffect, useState } from "react";
import axios from "axios";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { companyCurrency, formatDateTime } from "../../company/format";
import { INVOICE_API, apiError } from "./invoiceShared";
import { CARD, CARD_TITLE } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";
interface Limits {
  vendorPaymentLimit?: number | null;
  updatedBy?: string | null;
  updatedOn?: string | null;
}

const API = `${INVOICE_API}/approval-settings`;
const INPUT =
  "w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

/**
 * The vendor payment approval limit: a payment above it (in the company's currency) waits for someone other than the
 * person who recorded it to approve it before it pays the bill. Empty: payments take effect at once.
 */
export default function PaymentApprovalCard({ editable }: { editable: boolean }) {
  const [limits, setLimits] = useState<Limits | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get<Limits>(API).then(
      (res) => {
        setLimits(res.data);
        setValue(res.data.vendorPaymentLimit != null ? String(res.data.vendorPaymentLimit) : "");
      },
      (err) => ToasterService.error(apiError(err, "Could not load the payment approval limit")),
    );
  }, []);

  const save = async () => {
    const limit = value.trim() === "" ? null : Number(value);
    if (limit != null && (isNaN(limit) || limit < 0)) return ToasterService.error("The limit is an amount of 0 or more, or empty for none");
    setSaving(true);
    try {
      const { data } = await axios.put<Limits>(API, { vendorPaymentLimit: limit });
      setLimits(data);
      ToasterService.success(data.vendorPaymentLimit != null ? "Payment approval limit saved" : "Vendor payments no longer need approval");
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the payment approval limit"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${CARD} p-5`}>
      <h3 className={`${CARD_TITLE} mb-2 flex items-center gap-2`}>
        <ShieldCheckIcon className="h-4 w-4 text-cyan-600" /> {t("Payment approval limit")}
      </h3>
      <p className="mb-3 text-xs text-slate-600 dark:text-gray-300">
        {t("A vendor payment above this amount (in the company's currency) waits on Vendor Payments until someone with approval rights, other than the person who recorded it, approves it; only then is the bill paid. Advances above it can only be recorded by someone with approval rights. Leave it empty for no limit.")}
        {!editable && ` ${t("Only a finance administrator can change it.")}`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="number" min={0} className={INPUT} value={value} disabled={!editable} placeholder={t("No limit")}
            aria-label={t("Payment approval limit")} onChange={(e) => setValue(e.target.value)} />
          {companyCurrency()}
        </label>
        {editable && (
          <button type="button" disabled={saving} onClick={() => void save()}
            className="h-[38px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
            {t(saving ? "Saving..." : "Save limit")}
          </button>
        )}
        {limits?.updatedOn && (
          <span className="text-[11px] text-slate-400">{t("Last changed")} {formatDateTime(limits.updatedOn)} · {limits.updatedBy}</span>
        )}
      </div>
    </section>
  );
}
