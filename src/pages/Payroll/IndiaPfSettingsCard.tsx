import React, { useEffect, useState } from "react";
import axios from "axios";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { PF_SETTINGS_API, PfSettings, toPfSettings } from "./pfSettings";

/** The company's PF rules for India payroll: employer PF in or on top of the CTC, and the PF wage cap. */
const IndiaPfSettingsCard: React.FC<{ canUpdate: boolean }> = ({ canUpdate }) => {
  const [settings, setSettings] = useState<PfSettings | null>(null);
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(PF_SETTINGS_API)
      .then((res) => {
        const loaded = toPfSettings(res.data);
        setSettings(loaded);
        setLimit(String(loaded.pfWageLimit));
      })
      .catch(() => setSettings(null));
  }, []);

  const save = async (change: Partial<PfSettings>) => {
    setSaving(true);
    try {
      const { data } = await axios.put(PF_SETTINGS_API, change);
      const saved = toPfSettings(data);
      setSettings(saved);
      setLimit(String(saved.pfWageLimit));
      ToasterService.success(t("PF settings saved. They apply to payroll runs from now on."));
    } catch (error) {
      ToasterService.error(apiError(error, "The PF settings were not saved"));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;
  const disabled = !canUpdate || saving;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#191919] p-4 text-sm" data-testid="pf-settings">
      <div className="font-semibold text-gray-900 dark:text-gray-100">{t("Provident Fund (India)")}</div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t("Employee and employer each pay 12% of the basic. The employer's share goes to EPFO and is shown on the payslip as an employer contribution.")}
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{t("Employer PF")}</div>
          <label className="mt-1 flex items-start gap-2">
            <input type="radio" name="employerPfInCtc" checked={settings.employerPfInCtc} disabled={disabled}
              onChange={() => save({ employerPfInCtc: true })} />
            <span>{t("Part of the CTC")} <span className="text-xs text-gray-500">{t("(the salary split leaves room for it)")}</span></span>
          </label>
          <label className="mt-1 flex items-start gap-2">
            <input type="radio" name="employerPfInCtc" checked={!settings.employerPfInCtc} disabled={disabled}
              onChange={() => save({ employerPfInCtc: false })} />
            <span>{t("On top of the CTC")} <span className="text-xs text-gray-500">{t("(shown after the fixed salary)")}</span></span>
          </label>
        </div>

        <div>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={settings.pfWageCapped} disabled={disabled}
              onChange={(e) => save({ pfWageCapped: e.target.checked })} />
            <span>{t("Cap the PF wage at the statutory limit")} <span className="text-xs text-gray-500">{t("(otherwise PF is 12% of the full basic)")}</span></span>
          </label>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">{t("Monthly PF wage limit")}</span>
            <input type="number" min={1} value={limit} disabled={disabled}
              onChange={(e) => setLimit(e.target.value)}
              onBlur={() => {
                const value = Number(limit);
                if (value > 0 && value !== settings.pfWageLimit) save({ pfWageLimit: value });
                else setLimit(String(settings.pfWageLimit));
              }}
              className="w-28 rounded border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm" />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("The limit is also the EPS (pension) ceiling: EPS is 8.33% of the basic up to it.")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default IndiaPfSettingsCard;
