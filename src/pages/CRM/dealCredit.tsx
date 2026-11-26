import { useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { ExclamationTriangleIcon, LockClosedIcon, ShieldCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { ToasterService } from "../../Services/ToasterService";
import { formatDate, formatMoney } from "../../company/format";
import { apiError } from "./crmShared";
import { t } from "../../i18n/i18n";

// The credit-aware pipeline (backlog 8.4.16 / V1): each deal's customer, what it owes and how late (finance), its
// credit limit, and what the company's rule (CRM Settings) makes of it: OK, a warning, or blocked until finance
// releases the deal.

const CREDIT_API = "/v1/api/crm/customer-credit";
const DEALS_API = "/v1/api/crm/deals";

export interface CustomerCredit {
  customerId: number;
  customerName?: string | null;
  // In the company's currency; no limit = null
  creditLimit?: number | null;
  outstanding?: number | null;
  overdue?: number | null;
  overdueInvoices: number;
  oldestOverdueDays: number;
  oldestDueDate?: string | null;
  overLimit: boolean;
  overdueTooLong: boolean;
  level: "OK" | "WARN" | "BLOCK" | "UNKNOWN";
  rule?: string;
  allowedOverdueDays?: number;
  message?: string | null;
  // false: the amounts are left out because this person may not see finance's figures (INVOICE:VIEW)
  amountsShown?: boolean;
}

/** How long finance's release of a deal lasts (the service also ends it when the customer owes more than then). */
export const CREDIT_RELEASE_DAYS = 30;

/** Whether the deal's credit release still counts (given within the last 30 days). */
export const releaseActive = (deal: { creditReleasedAt?: string | null }) => {
  if (!deal.creditReleasedAt) return false;
  // Stored in UTC without a zone
  const at = Date.parse(deal.creditReleasedAt.endsWith("Z") ? deal.creditReleasedAt : `${deal.creditReleasedAt}Z`);
  return Number.isFinite(at) && Date.now() - at < CREDIT_RELEASE_DAYS * 24 * 60 * 60 * 1000;
};

export interface CreditDeal {
  id: number;
  dealName: string;
  owner?: string | null;
  customer?: { id: number } | null;
  creditReleasedAt?: string | null;
  creditReleasedByName?: string | null;
  creditReleaseReason?: string | null;
}

/** Who may let a deal go ahead over its customer's credit (as the service checks). */
const RELEASERS = ["SALES:APPROVE", "INVOICE:APPROVE", "CRM:APPROVE", "CRM:ADMIN"];

export const useCanReleaseCredit = () => {
  const { access } = useContext(AuthContext);
  return RELEASERS.some((p) => hasPermission(access, p));
};

/** The credit of the customers of these deals, by customer id; reloads when the set of customers changes. */
export const useCustomerCredit = (deals: { customer?: { id: number } | null }[]) => {
  const ids = Array.from(new Set(deals.map((d) => d.customer?.id).filter((id): id is number => !!id))).sort((a, b) => a - b);
  const key = ids.join(",");
  const [credit, setCredit] = useState<Record<number, CustomerCredit>>({});

  const load = useCallback(async () => {
    if (!key) {
      setCredit({});
      return;
    }
    try {
      const res = await axios.get<CustomerCredit[]>(CREDIT_API, { params: { customerIds: key } });
      const next: Record<number, CustomerCredit> = {};
      (Array.isArray(res.data) ? res.data : []).forEach((c) => (next[c.customerId] = c));
      setCredit(next);
    } catch {
      // No credit shown: the service still checks every move
      setCredit({});
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { credit, reload: load };
};

// In the company's currency, with its decimals
const money = (value?: number | null) => formatMoney(Number(value) || 0);

/**
 * On a quotation made from a CRM deal: the deal's customer's credit, before the customer accepts it (accepting marks
 * the deal Won, which the company's rule may block until finance releases it). Nothing for people without CRM rights.
 */
export function DealCreditNote({ dealId, customerId }: { dealId?: string | number | null; customerId?: string | number | null }) {
  const [state, setState] = useState<{ credit?: CustomerCredit; released: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    setState(null);
    if (!dealId || !customerId) return;
    (async () => {
      try {
        const [deal, credit] = await Promise.all([
          axios.get<CreditDeal>(`${DEALS_API}/${dealId}`),
          axios.get<CustomerCredit[]>(CREDIT_API, { params: { customerIds: String(customerId) } }),
        ]);
        if (alive) setState({ credit: Array.isArray(credit.data) ? credit.data[0] : undefined, released: releaseActive(deal.data) });
      } catch {
        // No CRM rights or CRM unreachable: the service still checks when the deal is won
      }
    })();
    return () => {
      alive = false;
    };
  }, [dealId, customerId]);

  const credit = state?.credit;
  if (!credit || credit.level === "OK" || credit.level === "UNKNOWN") return null;
  const blocked = credit.level === "BLOCK" && !state?.released;
  return (
    <p className={`col-span-full -mt-1 mb-2 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs ${
      state?.released ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        : blocked ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"}`}>
      {blocked ? <LockClosedIcon className="mt-px h-3.5 w-3.5 shrink-0" /> : <ExclamationTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" />}
      <span>
        {credit.message}{" "}
        {state?.released
          ? t("Finance has released the deal, so it can be won.")
          : blocked
            ? t("The deal can't be won until finance releases it: ask from the deal in CRM.")
            : t("Check with finance before the customer accepts.")}
      </span>
    </p>
  );
}

/** A deal card's or row's chip: released, blocked, over the limit, or overdue; nothing when all is well. */
export function CreditChip({ credit, released }: { credit?: CustomerCredit; released?: boolean }) {
  if (released && credit && (credit.overLimit || credit.overdueTooLong)) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        title={t("Finance let this deal go ahead over the customer's credit")}>
        <ShieldCheckIcon className="h-3 w-3" /> {t("Credit released")}
      </span>
    );
  }
  if (!credit || credit.level === "OK" || credit.level === "UNKNOWN") return null;
  const blocked = credit.level === "BLOCK";
  const label = credit.overdueTooLong
    ? t("Overdue {days} d", { days: String(credit.oldestOverdueDays) })
    : t("Over credit limit");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold ${
        blocked ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      }`}
      title={credit.message || undefined}
    >
      {blocked ? <LockClosedIcon className="h-3 w-3" /> : <ExclamationTriangleIcon className="h-3 w-3" />}
      {label}
    </span>
  );
}

/** What the customer owes, as lines for the dialog. */
export function CreditFacts({ credit }: { credit: CustomerCredit }) {
  if (credit.amountsShown === false) {
    return (
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-gray-800/60 dark:text-gray-300">
        {credit.overdueInvoices > 0 && (
          <p className="mb-1 font-semibold text-slate-800 dark:text-gray-100">
            {t("{count} invoice(s) overdue, the oldest {days} days", {
              count: String(credit.overdueInvoices),
              days: String(credit.oldestOverdueDays),
            })}
          </p>
        )}
        <p>{t("The amounts are shown to finance only.")}</p>
      </div>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs dark:bg-gray-800/60">
      <dt className="text-slate-500">{t("Owes")}</dt>
      <dd className="text-end font-semibold text-slate-800 dark:text-gray-100">{money(credit.outstanding)}</dd>
      <dt className="text-slate-500">{t("Credit limit")}</dt>
      <dd className={`text-end font-semibold ${credit.overLimit ? "text-rose-600" : "text-slate-800 dark:text-gray-100"}`}>
        {credit.creditLimit == null ? t("No limit") : money(credit.creditLimit)}
      </dd>
      <dt className="text-slate-500">{t("Overdue")}</dt>
      <dd className={`text-end font-semibold ${credit.overdueTooLong ? "text-rose-600" : "text-slate-800 dark:text-gray-100"}`}>
        {money(credit.overdue)}
        {credit.overdueInvoices > 0 && (
          <span className="block font-normal text-slate-500">
            {t("{count} invoice(s), the oldest due {date} ({days} days)", {
              count: String(credit.overdueInvoices),
              date: credit.oldestDueDate ? formatDate(credit.oldestDueDate) : "—",
              days: String(credit.oldestOverdueDays),
            })}
          </span>
        )}
      </dd>
    </dl>
  );
}

interface DialogProps {
  // blocked: the company's rule stops the move until finance releases the deal; otherwise a warning to confirm
  prompt: { deal: CreditDeal; stageName: string; credit: CustomerCredit; blocked: boolean; message?: string | null } | null;
  me?: string | null;
  onClose: () => void;
  // Move anyway (a warning), or move now that it is released
  onProceed: (deal: CreditDeal) => void;
}

/** Before a deal moves to Negotiation or Won for a customer over its credit or overdue. */
export function CreditDialog({ prompt, me, onClose, onProceed }: DialogProps) {
  const canRelease = useCanReleaseCredit();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setReason(""), [prompt]);
  if (!prompt) return null;
  const { deal, credit, blocked, stageName } = prompt;
  const own = !!me && !!deal.owner && deal.owner.toLowerCase() === me.toLowerCase();

  const ask = async () => {
    setBusy(true);
    try {
      await axios.post(`${DEALS_API}/${deal.id}/credit-release-request`);
      ToasterService.success(t("Finance has been asked"), t("The sales and finance approvers see it in their alerts."));
      onClose();
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't ask finance"));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!reason.trim()) {
      ToasterService.error(t("Say why the deal may go ahead"));
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`${DEALS_API}/${deal.id}/credit-release`, { reason: reason.trim() });
      ToasterService.success(t("Deal released"));
      onProceed({ ...deal, ...res.data });
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't release the deal"));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"
      aria-label={t("Customer credit")}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${blocked ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-700"}`}>
              {blocked ? <LockClosedIcon className="h-5 w-5" /> : <ExclamationTriangleIcon className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {blocked ? t("Finance must release this deal first") : t("Check the customer's credit")}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t('"{deal}" → {stage}', { deal: deal.dealName, stage: stageName })}
              </p>
            </div>
          </div>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-200">{prompt.message || credit.message}</p>
        <CreditFacts credit={credit} />

        {blocked && canRelease && !own && (
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Release it: why may it go ahead?")}</span>
            <textarea value={reason} rows={2} maxLength={300} disabled={busy} onChange={(e) => setReason(e.target.value)}
              placeholder={t("e.g. Cheque for the overdue amount received, clears on Sunday")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </label>
        )}
        {blocked && canRelease && own && (
          <p className="mt-3 text-xs text-gray-500">{t("It's your deal, so someone else with an approval right must release it.")}</p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="h-9 rounded-lg border border-gray-300 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
            {t("Cancel")}
          </button>
          {blocked ? (
            <>
              <button type="button" onClick={ask} disabled={busy}
                className="h-9 rounded-lg border border-cyan-600 px-4 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50">
                {t("Ask finance to release")}
              </button>
              {canRelease && !own && (
                <button type="button" onClick={release} disabled={busy || !reason.trim()}
                  className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
                  {t("Release and move")}
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={() => onProceed(deal)} disabled={busy}
              className="h-9 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              {t("Move anyway")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
