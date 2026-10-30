import { useEffect, useState } from "react";
import { AlertTriangle, Download, X } from "lucide-react";
import { t } from "../../i18n/i18n";
import { formatDate, formatMoney, formatNumber } from "../../company/format";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import {
  SEPARATION_LABELS,
  SettlementLine,
  SettlementStatement,
  downloadSettlement,
  gratuityMismatch,
  leaveMismatch,
  loadSettlement,
  serviceLength,
} from "./settlementStatement";

interface Props {
  exitRequestId: number;
  onClose: () => void;
}

/** A leaving Gulf employee's final settlement: the gratuity worked out and the final month's pay that carries it. */
export default function SettlementStatementDialog({ exitRequestId, onClose }: Props) {
  const [statement, setStatement] = useState<SettlementStatement | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    loadSettlement(exitRequestId)
      .then((data) => active && setStatement(data))
      .catch((e) => active && setError(apiError(e, "The settlement could not be loaded")));
    return () => {
      active = false;
    };
  }, [exitRequestId]);

  const money = (value: number | null | undefined) => formatMoney(value ?? 0, { currency: statement?.currency });
  const download = async () => {
    if (!statement) return;
    setDownloading(true);
    try {
      await downloadSettlement(statement);
    } catch (e) {
      ToasterService.error(apiError(e, "The statement could not be made"));
    } finally {
      setDownloading(false);
    }
  };

  const lines = (rows: SettlementLine[]) =>
    rows.map((row, i) => (
      <div key={`${row.label}-${i}`} className="flex justify-between gap-3 py-1">
        <span className="text-gray-600 dark:text-gray-300">{t(row.label)}</span>
        <span className={`font-medium tabular-nums ${row.amount < 0 ? "text-red-600" : "text-gray-900 dark:text-white"}`} dir="ltr">
          {money(row.amount)}
        </span>
      </div>
    ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-[#191919]"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("Final settlement")}>
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("Final settlement")}</h3>
            {statement && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {statement.employeeName} · {statement.employeeCode} · {statement.designation || "—"}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t("Close")}><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs">
          {!statement && !error && <p className="text-gray-500">{t("Loading...")}</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
          {statement && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3 dark:border-[#2a2a2a] dark:bg-[#222222]">
                {([
                  ["Joined", formatDate(statement.joiningDate)],
                  ["Last working day", formatDate(statement.lastWorkingDay)],
                  ["Service", statement.gratuity.due || statement.gratuity.years
                    ? `${serviceLength(statement.gratuity.years, t)} (${formatNumber(statement.gratuity.years, 2)})` : "—"],
                  ["How it ended", t(SEPARATION_LABELS[statement.separationType] ?? statement.separationType)],
                  ["Monthly wage", statement.gratuity.due ? money(statement.gratuity.monthlyWage) : "—"],
                  ["Wage basis", statement.gratuity.wageBasis ? t(statement.gratuity.wageBasis) : "—"],
                ] as const).map(([k, v]) => (
                  <div key={k}>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t(k)}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{v}</span>
                  </div>
                ))}
              </div>
              {statement.gratuity.unpaidDays > 0 && (
                <p className="text-gray-500">{statement.gratuity.unpaidDays} {t("unpaid days are not counted as service.")}</p>
              )}

              <section>
                <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{t("End-of-service gratuity")}</h4>
                {!statement.gratuity.due ? (
                  <p className="text-gray-600 dark:text-gray-300">{t(statement.gratuity.note || "No gratuity is due")}</p>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-3 dark:divide-[#2a2a2a] dark:border-[#2a2a2a]">
                    {lines(statement.gratuity.lines)}
                    <div className="flex justify-between py-1.5 text-sm font-semibold">
                      <span>{t("Gratuity")}</span>
                      <span className="tabular-nums" dir="ltr">{money(statement.gratuity.amount)}</span>
                    </div>
                  </div>
                )}
                {statement.gratuity.due && statement.gratuity.note && (
                  <p className={`mt-1 ${statement.gratuity.approximate ? "text-amber-700" : "text-gray-500"}`}>{t(statement.gratuity.note)}</p>
                )}
              </section>

              <section>
                <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{t("Unused annual leave")}</h4>
                {statement.unusedLeave?.days > 0 ? (
                  <div className="flex justify-between gap-3 rounded-lg border border-gray-200 px-3 py-1.5 dark:border-[#2a2a2a]">
                    <span className="text-gray-600 dark:text-gray-300">
                      {formatNumber(statement.unusedLeave.days, 1)} {t("days")} × {money(statement.unusedLeave.dailyWage)}{" "}
                      ({t(statement.unusedLeave.wageBasis)} / 30)
                    </span>
                    <span className="font-semibold tabular-nums" dir="ltr">{money(statement.unusedLeave.amount)}</span>
                  </div>
                ) : (
                  <p className="text-gray-500">{t("None recorded. Enter the days not taken in the exit details to pay them with the final pay.")}</p>
                )}
              </section>

              <section>
                <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{t("Final pay")} ({statement.finalMonth})</h4>
                {!statement.finalPayProcessed ? (
                  <p className="text-gray-600 dark:text-gray-300">
                    {t("Not paid yet: run this month's payroll (Payroll Engine). The gratuity is paid with it, on the payslip and in the bank file.")}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 px-3 dark:border-[#2a2a2a]">
                      <p className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t("Earnings")}</p>
                      {lines(statement.earnings)}
                      <div className="flex justify-between border-t border-gray-100 py-1.5 font-semibold dark:border-[#2a2a2a]">
                        <span>{t("Total")}</span><span dir="ltr">{money(statement.totalEarnings)}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-3 dark:border-[#2a2a2a]">
                      <p className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t("Deductions")}</p>
                      {statement.deductions.length ? lines(statement.deductions) : <p className="py-1 text-gray-400">—</p>}
                      <div className="flex justify-between border-t border-gray-100 py-1.5 font-semibold dark:border-[#2a2a2a]">
                        <span>{t("Total")}</span><span dir="ltr">{money(statement.totalDeductions)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between rounded-lg bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900 sm:col-span-2 dark:bg-[#222222] dark:text-white">
                      <span>{t("Net amount paid")}</span><span dir="ltr">{money(statement.netPay)}</span>
                    </div>
                  </div>
                )}
                {leaveMismatch(statement) && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {t("The payroll paid unused leave of")} {money(statement.unusedLeavePaid)}; {t("it now works out at")} {money(statement.unusedLeave.amount)}.{" "}
                      {t("Roll back and run that month again to correct it.")}
                    </span>
                  </p>
                )}
                {gratuityMismatch(statement) && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {t("The payroll paid a gratuity of")} {money(statement.gratuityPaid)}; {t("it now works out at")} {money(statement.gratuity.amount)}.{" "}
                      {t("Roll back and run that month again to correct it.")}
                    </span>
                  </p>
                )}
              </section>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            {t("Close")}
          </button>
          <button type="button" onClick={download} disabled={!statement || downloading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            <Download className="h-3.5 w-3.5" />
            {t(downloading ? "Preparing..." : "Download statement")}
          </button>
        </div>
      </div>
    </div>
  );
}
