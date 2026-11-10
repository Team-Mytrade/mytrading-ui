import React, { useEffect, useState } from "react";
import axios from "axios";
import PaginatedPopup from "../common/unpopup";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { todayIso } from "../../utils/localDate";
import { t } from "../../i18n/i18n";

type RangeChoice = "LAST_3" | "LAST_6" | "THIS_FY" | "CUSTOM";

const shift = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const label = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "short", year: "numeric" });
};

/** The months a choice covers, ending with the month before this one (the latest that can have a payslip) or this one. */
const rangeOf = (choice: RangeChoice, from: string, to: string): [string, string] => {
  const thisMonth = todayIso().slice(0, 7);
  switch (choice) {
    case "LAST_3":
      return [shift(thisMonth, -2), thisMonth];
    case "LAST_6":
      return [shift(thisMonth, -5), thisMonth];
    case "THIS_FY": {
      const [y, m] = thisMonth.split("-").map(Number);
      return [`${m >= 4 ? y : y - 1}-04`, thisMonth];
    }
    default:
      return [from, to];
  }
};

// File downloads ask for a blob, so an error's JSON body arrives as one too
const blobError = async (err: unknown, fallback: string) => {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      return body.message || body.error || fallback;
    } catch {
      return fallback;
    }
  }
  return apiError(err, fallback);
};

interface PayslipZipDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Whose payslips; an employee may only download their own (the service checks). */
  employeeId: number;
  employeeName: string;
}

/** Download an employee's payslips as one ZIP: the last 3 or 6 months, this financial year, or a custom range. */
const PayslipZipDialog: React.FC<PayslipZipDialogProps> = ({ isOpen, onClose, employeeId, employeeName }) => {
  const [choice, setChoice] = useState<RangeChoice>("LAST_3");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setChoice("LAST_3");
      setFrom("");
      setTo("");
    }
  }, [isOpen]);

  const [fromMonth, toMonth] = rangeOf(choice, from, to);
  const thisMonth = todayIso().slice(0, 7);

  const download = async () => {
    if (!fromMonth || !toMonth) {
      ToasterService.warning(t("Choose the from and to months"));
      return;
    }
    if (fromMonth > toMonth) {
      ToasterService.warning(t("The from month can't be after the to month"));
      return;
    }
    setBusy(true);
    try {
      const response = await axios.get(`/v1/api/payroll/payslips/download-zip`, {
        params: { employeeId, fromMonth, toMonth },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `payslips_${employeeName.replace(/\s+/g, "_")}_${fromMonth}_to_${toMonth}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      ToasterService.success(t("Payslips downloaded"));
      onClose();
    } catch (error) {
      ToasterService.error(await blobError(error, "The payslips could not be downloaded"));
    } finally {
      setBusy(false);
    }
  };

  const options: { value: RangeChoice; title: string; hint: string }[] = [
    { value: "LAST_3", title: t("Last 3 months"), hint: `${label(shift(thisMonth, -2))} – ${label(thisMonth)}` },
    { value: "LAST_6", title: t("Last 6 months"), hint: `${label(shift(thisMonth, -5))} – ${label(thisMonth)}` },
    { value: "THIS_FY", title: t("This financial year"), hint: `${label(rangeOf("THIS_FY", "", "")[0])} – ${label(thisMonth)}` },
    { value: "CUSTOM", title: t("Custom range"), hint: t("Pick the months") },
  ];

  return (
    <PaginatedPopup
      isOpen={isOpen}
      title={t("Download payslips (ZIP)")}
      subtitle={`${t("Employee")}: ${employeeName}`}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        download();
      }}
      submitLabel={t("Download ZIP")}
      submitting={busy}
      cancelLabel={t("Cancel")}
      maxWidthClassName="max-w-lg"
      fields={[
        <fieldset key="range" className="col-span-2">
          <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t("Which payslips")}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <label key={o.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition ${choice === o.value ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30" : "border-gray-200 hover:border-cyan-300 dark:border-gray-700"}`}>
                <input type="radio" name="payslip-range" value={o.value} checked={choice === o.value}
                  onChange={() => setChoice(o.value)} className="mt-0.5 accent-cyan-600" />
                <span>
                  <span className="block font-medium text-gray-900 dark:text-white">{o.title}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>,
        ...(choice === "CUSTOM"
          ? [
              <div key="from-month">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="zip-from">{t("From month")}</label>
                <input id="zip-from" type="month" value={from} max={thisMonth} onChange={(e) => setFrom(e.target.value)} required
                  className="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#191919] dark:text-white" />
              </div>,
              <div key="to-month">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="zip-to">{t("To month")}</label>
                <input id="zip-to" type="month" value={to} max={thisMonth} onChange={(e) => setTo(e.target.value)} required
                  className="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#191919] dark:text-white" />
              </div>,
            ]
          : []),
        <div key="info" className="col-span-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200">
          {fromMonth && toMonth
            ? `${t("One ZIP with every payslip from")} ${label(fromMonth)} ${t("to")} ${label(toMonth)}. ${t("Months without a payslip are skipped.")}`
            : t("Choose the from and to months.")}
        </div>,
      ]}
    />
  );
};

export default PayslipZipDialog;
