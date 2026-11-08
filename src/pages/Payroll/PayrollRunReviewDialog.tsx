import React, { useEffect, useState } from "react";
import axios from "axios";
import { X } from "lucide-react";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";

interface ReviewRow {
  employeeId: number; employeeCode?: string | null; employeeName?: string | null; department?: string | null; month: string;
  currency?: string | null; totalEarnings?: number | null; totalDeductions?: number | null; netPay: number;
  previousNetPay?: number | null; change?: number | null; changePercent?: number | null; lossOfPayDays: number; flags: string[];
}

interface Missing { employeeId: number; employeeCode?: string | null; employeeName?: string | null; lastNetPay?: number | null; reason: string }

export interface PayrollRunReview {
  batchReference: string; salaryMonth?: string | null; approvalState: string; preparedBy?: string | null; preparedAt?: string | null;
  approvedBy?: string | null; approvedAt?: string | null; varianceThresholdPercent: number; employeeCount: number;
  totalNet: number; previousTotalNet: number; totalEarnings: number; totalDeductions: number; flaggedCount: number;
  rows: ReviewRow[]; notPaidThisMonth: Missing[];
}

const money = (n?: number | null) => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * Review & approve a payroll run (maker-checker): every salary against last month with what needs a look, who was
 * paid last month but not now, then approve (bank file, payslips and books are released) or send it back.
 */
const PayrollRunReviewDialog: React.FC<{ reference: string; onClose: () => void; onDecided: () => void }> = ({ reference, onClose, onDecided }) => {
  const [review, setReview] = useState<PayrollRunReview | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get<PayrollRunReview>(`/v1/api/payroll/batches/${reference}/review`)
      .then((res) => setReview(res.data))
      .catch((err) => { ToasterService.error(apiError(err, "The run could not be loaded")); onClose(); });
  }, [reference]);

  const waiting = review?.approvalState === "PENDING_APPROVAL";

  const approve = async () => {
    setBusy(true);
    try {
      const { data } = await axios.put(`/v1/api/payroll/batches/${reference}/approve`, { note: note.trim() || null });
      ToasterService.success(`${reference} approved`, `${data.payslipsGenerated ?? 0} payslip(s) made; the bank file and books are released`);
      if (data.payslipProblem) ToasterService.warning("Payslips were not made", data.payslipProblem, 8000);
      onDecided();
    } catch (err) {
      ToasterService.error(apiError(err, "The run was not approved"));
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async () => {
    if (!note.trim()) return ToasterService.warning("Say what needs fixing in the note");
    if (!window.confirm(`Send ${reference} back? Its salaries are rolled back so it can be run again.`)) return;
    setBusy(true);
    try {
      await axios.put(`/v1/api/payroll/batches/${reference}/reject`, null, { params: { reason: note.trim() } });
      ToasterService.success(`${reference} sent back`, "Its salaries were rolled back");
      onDecided();
    } catch (err) {
      ToasterService.error(apiError(err, "The run was not sent back"));
    } finally {
      setBusy(false);
    }
  };

  const rows = (review?.rows || []).filter((r) => !onlyFlagged || r.flags.some((f) => f !== "Full & final"));
  const change = review ? review.totalNet - review.previousTotalNet : 0;

  return (
    <div data-overlay-dim data-overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div data-overlay-panel className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-[#191919]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("Review run")} {reference}</h3>
            {review && (
              <p className="text-xs text-gray-500">
                {review.salaryMonth} · {t("prepared by")} {review.preparedBy || "—"}
                {review.approvedBy ? ` · ${t("approved by")} ${review.approvedBy}` : ""}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t("Close")}><X size={18} /></button>
        </div>

        {!review ? (
          <p className="p-6 text-sm text-gray-500">{t("Loading...")}</p>
        ) : (
          <div className="space-y-4 overflow-y-auto px-5 py-4 text-xs">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([
                ["Employees", String(review.employeeCount)],
                ["Net pay", money(review.totalNet)],
                ["Last month (same people)", money(review.previousTotalNet)],
                ["Change", `${change >= 0 ? "+" : ""}${money(change)}`],
                ["Need a look", String(review.flaggedCount)],
              ] as const).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#2a2a2a] dark:bg-[#222222]">
                  <span className="block text-[10px] font-semibold uppercase text-gray-500">{t(k)}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{v}</span>
                </div>
              ))}
            </div>

            {review.notPaidThisMonth.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">
                <p className="mb-1 font-semibold">{t("Paid last month, not this month")} ({review.notPaidThisMonth.length})</p>
                {review.notPaidThisMonth.map((m) => (
                  <p key={m.employeeId}>{m.employeeName || m.employeeId} {m.employeeCode ? `(${m.employeeCode})` : ""}: {m.reason} · {t("last net")} {money(m.lastNetPay)}</p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-gray-500">{t("Flags a net pay change of")} {review.varianceThresholdPercent}% {t("or more against last month.")}</p>
              <label className="flex items-center gap-1.5 text-gray-600">
                <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
                {t("Only what needs a look")}
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-[#2a2a2a]">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-[10px] uppercase text-gray-500 dark:bg-[#222222]">
                  <tr>
                    <th className="px-2 py-1.5">{t("Employee")}</th><th className="px-2">{t("Month")}</th>
                    <th className="px-2 text-right">{t("Earnings")}</th><th className="px-2 text-right">{t("Deductions")}</th>
                    <th className="px-2 text-right">{t("Net pay")}</th><th className="px-2 text-right">{t("Last month")}</th>
                    <th className="px-2 text-right">{t("Change")}</th><th className="px-2">{t("Flags")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                  {rows.map((r) => (
                    <tr key={`${r.employeeId}-${r.month}`} className={r.flags.length ? "bg-amber-50/40 dark:bg-transparent" : ""}>
                      <td className="px-2 py-1.5">
                        <span className="font-semibold text-gray-900 dark:text-white">{r.employeeName || r.employeeId}</span>
                        <span className="block text-[10px] text-gray-500">{r.employeeCode} {r.department ? `· ${r.department}` : ""}</span>
                      </td>
                      <td className="px-2">{r.month}</td>
                      <td className="px-2 text-right">{money(r.totalEarnings)}</td>
                      <td className="px-2 text-right">{money(r.totalDeductions)}</td>
                      <td className="px-2 text-right font-semibold">{money(r.netPay)}</td>
                      <td className="px-2 text-right text-gray-500">{money(r.previousNetPay)}</td>
                      <td className={`px-2 text-right ${r.change != null && r.change < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {r.change == null ? "—" : `${r.change >= 0 ? "+" : ""}${money(r.change)}`}
                        {r.changePercent != null && <span className="block text-[10px]">{r.changePercent}%</span>}
                      </td>
                      <td className="px-2">
                        <div className="flex flex-wrap gap-1">
                          {r.flags.map((f) => <span key={f} className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">{f}</span>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {waiting && (
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("Note (required to send back)")}
                <input className="mt-1 h-9 w-full rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-[#222222] dark:text-white"
                  maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. checked the bonuses and new joiners")} />
              </label>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">{t("Close")}</button>
          {waiting && (
            <>
              <button type="button" onClick={sendBack} disabled={busy} className="rounded-lg border border-rose-200 bg-white px-4 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                {t("Send back")}
              </button>
              <button type="button" onClick={approve} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {t(busy ? "Saving..." : "Approve run")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayrollRunReviewDialog;
