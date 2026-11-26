import { useContext, useState } from "react";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { ToasterService } from "../../Services/ToasterService";
import { formatDateTime } from "../../company/format";
import { PriceApprovalInfo, quoteCheckApi } from "../../sales/quoteCheckApi";
import { t } from "../../i18n/i18n";

/** The server's reason sentences, in the reader's language. */
export const approvalReasonText = (reason: string): string => {
  const floor = reason.match(/^Line (\d+) is below the company's margin floor of ([\d.]+)%$/);
  if (floor) return t("Line {line} is below the company's margin floor of {percent}%", { line: floor[1], percent: floor[2] });
  const list = reason.match(/^Line (\d+) is priced ([\d.]+), below its price-list price of ([\d.]+)$/);
  if (list) return t("Line {line} is priced {price}, below its price-list price of {list}", { line: list[1], price: list[2], list: list[3] });
  if (reason.startsWith("The margin couldn't be checked")) return t("The margin couldn't be checked (inventory can't be reached), so an approver must look at the prices");
  return reason;
};

/** Whether the quotation can go to the customer (sent, emailed, WhatsApp'd) or be accepted. */
export const priceCleared = (q?: PriceApprovalInfo | null) => !q || (q.priceApproval !== "PENDING" && q.priceApproval !== "REJECTED");

/**
 * A quotation's price approval (backlog 8.4.7): why it waits, and for sales approvers other than whoever saved the
 * prices, Approve / Reject with a reason. Nothing when no approval is needed.
 */
export default function PriceApprovalPanel({ quotation, onDecided }: { quotation?: PriceApprovalInfo | null; onDecided?: () => void }) {
  const { access, user } = useContext(AuthContext);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const status = quotation?.priceApproval;
  if (!quotation?.id || !status) return null;
  const me = String(user?.userId || user?.id || "");
  const mine = !!me && me === String(quotation.priceApprovalAskedBy || "");
  const canDecide = status === "PENDING" && hasPermission(access, "SALES:APPROVE") && !mine;
  const reasons = quotation.priceApprovalReasons ?? [];

  const decide = async (approve: boolean) => {
    if (!reason.trim()) {
      ToasterService.error(t(approve ? "Say why the prices are approved" : "Say why the prices are rejected"));
      return;
    }
    setBusy(true);
    try {
      await (approve ? quoteCheckApi.approve(quotation.id!, reason.trim()) : quoteCheckApi.reject(quotation.id!, reason.trim()));
      ToasterService.success(t(approve ? "Prices approved" : "Prices rejected"));
      setReason("");
      onDecided?.();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      ToasterService.error(message || t("The decision could not be saved"));
    } finally {
      setBusy(false);
    }
  };

  const tone = status === "PENDING"
    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    : status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
      : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100";
  const Icon = status === "PENDING" ? ClockIcon : status === "APPROVED" ? CheckCircleIcon : XCircleIcon;

  return (
    <div className={`col-span-full mb-2 rounded-lg border px-3 py-2.5 text-sm ${tone}`} data-price-approval={status}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold">
            {status === "PENDING"
              ? t("Waiting for price approval: it can't be sent or accepted until a sales approver decides")
              : status === "APPROVED"
                ? t("Prices approved by {name} on {date}", { name: quotation.priceApprovalByName || "—", date: formatDateTime(quotation.priceApprovalAt) })
                : t("Prices rejected by {name} on {date}: change them and save to ask again", {
                    name: quotation.priceApprovalByName || "—",
                    date: formatDateTime(quotation.priceApprovalAt),
                  })}
          </div>
          {reasons.length > 0 && (
            <ul className="list-disc space-y-0.5 ps-5 text-xs">
              {reasons.map((r, i) => (
                <li key={i}>{approvalReasonText(r)}</li>
              ))}
            </ul>
          )}
          {quotation.priceApprovalNote && status !== "PENDING" && (
            <div className="text-xs">
              <span className="font-medium">{t("Reason")}:</span> {quotation.priceApprovalNote}
            </div>
          )}
          {status === "PENDING" && mine && (
            <div className="text-xs opacity-80">{t("You saved these prices, so another sales approver must decide.")}</div>
          )}
          {canDecide && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder={t("Reason for your decision")}
                aria-label={t("Reason for your decision")}
                className="min-w-[220px] flex-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-amber-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <button type="button" disabled={busy} onClick={() => decide(true)}
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {t("Approve prices")}
              </button>
              <button type="button" disabled={busy} onClick={() => decide(false)}
                className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {t("Reject prices")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
