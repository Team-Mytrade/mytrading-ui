import { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowPathIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { GeneralAccount, INVOICE_API, accountLabel, apiError } from "./invoiceShared";
import { CARD, CARD_TITLE, PAGE_BODY, TOOL_BUTTON } from "../Payroll/hrmsUi";
import PeriodLockCard from "./PeriodLockCard";
import FxRevaluationCard from "./FxRevaluationCard";
import YearEndCloseCard from "./YearEndCloseCard";
import PaymentApprovalCard from "./PaymentApprovalCard";

import { t } from "../../i18n/i18n";
interface PostingAccountView {
  role: string;
  label: string;
  // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE: the account must be of this type
  requiredType: string;
  accountId: number;
  accountCode: string;
  accountName: string;
}

interface BackfillResult {
  invoices: number;
  receipts: number;
  creditNotes: number;
  creditsApplied: number;
  bills: number;
  vendorPayments: number;
  debitNotes: number;
  // Dated in a locked period: left unposted
  lockedSkipped?: number;
}

// What each role is used for, in the order of the documents' flow
const USED_FOR: Record<string, string> = {
  RECEIVABLES: "What customers owe: sales invoices, receipts, credit notes.",
  SALES: "Sales invoices (before tax).",
  SALES_RETURNS: "Credit notes (before tax).",
  EXCHANGE_DIFFERENCES: "Gains and losses when a foreign-currency invoice or bill is settled at a different rate.",
  CHEQUES_RECEIVED: "Customers' post-dated cheques held until they clear into the bank (Banking → Cheques).",
  CHEQUES_ISSUED: "Post-dated cheques given to vendors until the bank pays them.",
  BANK_CHARGES: "Charges the bank makes, such as on a bounced or stopped cheque.",
  MARKETPLACE_FEES: "Amazon and noon commissions and fees taken from their payouts, and other payout adjustments.",
  RETAINED_EARNINGS: "Each closed year's profit or loss (the year-end close).",
  UNREALISED_EXCHANGE:"Month-end revaluation of open foreign-currency invoices and bills (reversed the next day).",
  OUTPUT_TAX: "VAT / GST charged on sales, and reverse-charge VAT on purchases.",
  CUSTOMER_CREDIT: "Advances, overpayments and credit notes kept for customers.",
  CASH: "Receipts and payments made in cash, when no cash box is set up in Bank & Cash.",
  BANK: "Receipts and payments by bank transfer, cheque or card, when no bank account is set up in Bank & Cash.",
  PAYABLES: "What the company owes vendors: bills, payments, debit notes.",
  INPUT_TAX: "VAT / GST paid on bills, reclaimable.",
  GOODS_RECEIVED_NOT_BILLED: "Goods received into stock until their bill is recorded (cleared by bills and debit notes).",
  PURCHASES: "Bills that are not for received goods (services, expenses), and expenses recorded without an account.",
  OTHER_INCOME: "Income recorded on Expenses & Revenue without an account of its own.",
  INVENTORY: "Stock value: receipts in, sales and write-offs out, at average cost.",
  COST_OF_SALES: "Cost of the goods sold and returned.",
  STOCK_ADJUSTMENTS: "Stock counted up, written off or damaged.",
  OPENING_BALANCE: "Opening stock entered when starting to use the system.",
  FIXED_ASSETS: "The cost of assets in the register.",
  ACCUMULATED_DEPRECIATION: "Depreciation so far on those assets.",
  DEPRECIATION_EXPENSE: "Each month's depreciation.",
  ASSET_DISPOSALS: "Gains and losses when assets are sold or scrapped.",
  // Payroll runs and salary payments (from the payroll service)
  SALARIES_EXPENSE: "Each payroll run's earnings, less loss of pay and unpaid sick days.",
  EMPLOYER_CONTRIBUTIONS: "The employer's share of pension, social insurance, PF and ESI.",
  GRATUITY_EXPENSE: "Each month's end-of-service gratuity earned.",
  SALARIES_PAYABLE: "Net pay owed from a payroll run until the salary payment is recorded.",
  SOCIAL_SECURITY_PAYABLE: "Pension, social insurance, PF and ESI withheld or owed, until paid to the authority.",
  PAYROLL_TAX_PAYABLE: "Income tax (TDS) and professional tax withheld from salaries.",
  PAYROLL_DEDUCTIONS: "Other deductions from pay, such as loan recoveries.",
  GRATUITY_PROVISION: "End-of-service gratuity earned so far; used when it is paid to a leaving employee.",
  // Sales commission (Invoice → Sales Commission)
  SALES_COMMISSION: "Sales people's commission, booked when a month's statement is approved.",
  COMMISSION_PAYABLE: "Approved commission owed to sales people, until paid from the bank or with salaries.",
};

const SELECT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

/**
 * Which accounts the automatic postings use. Each role starts on a default account (created in the chart of
 * accounts the first time); finance administrators (INVOICE:ADMIN) can point it at another account of the same type.
 */
export default function PostingAccounts() {
  const { access } = useContext(AuthContext);
  const editable = hasPermission(access, "INVOICE:ADMIN");
  const [roles, setRoles] = useState<PostingAccountView[]>([]);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  // Bumped when a year-end close moves the lock date, so the lock card shows it
  const [lockVersion, setLockVersion] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [roleRes, accountRes] = await Promise.all([
        axios.get<PostingAccountView[]>(`${INVOICE_API}/accounting/posting-accounts`),
        axios.get<GeneralAccount[]>(`${INVOICE_API}/general-accounts`),
      ]);
      setRoles(Array.isArray(roleRes.data) ? roleRes.data : []);
      setAccounts(Array.isArray(accountRes.data) ? accountRes.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the posting accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const byType = useMemo(() => {
    const groups: Record<string, GeneralAccount[]> = {};
    accounts
      .filter((a) => a.isActive !== false && a.allowTransactions !== false)
      .forEach((a) => (groups[a.accountType] ??= []).push(a));
    return groups;
  }, [accounts]);

  const change = async (role: PostingAccountView, accountId: number) => {
    if (accountId === role.accountId) return;
    setSaving(role.role);
    try {
      const { data } = await axios.put<PostingAccountView>(`${INVOICE_API}/accounting/posting-accounts/${role.role}`, { accountId });
      setRoles((list) => list.map((r) => (r.role === data.role ? data : r)));
      ToasterService.success(`${role.label} now posts to ${accountLabel(data)}`);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not change the account"));
    } finally {
      setSaving(null);
    }
  };

  const backfill = async () => {
    if (!window.confirm("Post invoices, receipts, notes, bills and payments recorded before automatic postings? Documents already posted are skipped.")) return;
    setBackfilling(true);
    try {
      const { data } = await axios.post<BackfillResult>(`${INVOICE_API}/accounting/backfill`);
      ToasterService.success("Earlier documents posted",
        `${data.invoices} invoice(s), ${data.receipts} receipt(s), ${data.creditNotes} credit note(s), ${data.bills} bill(s), ${data.vendorPayments} vendor payment(s), ${data.debitNotes} debit note(s) checked.`
          + (data.lockedSkipped ? ` ${data.lockedSkipped} dated in the locked period were left out.` : ""));
    } catch (err) {
      ToasterService.error(apiError(err, "Could not post the earlier documents"));
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <>
      <PageMeta title={t("Posting Accounts")} description="Accounts used by automatic journal postings" />
      <PageBreadcrumb
        pageTitle="Posting Accounts"
        actions={editable ? (
          <button type="button" className={TOOL_BUTTON} onClick={backfill} disabled={backfilling}>
            <ArrowPathIcon className="h-3.5 w-3.5" /> {t(backfilling ? "Posting..." : "Post earlier documents")}
          </button>
        ) : undefined}
      />
      <div className={PAGE_BODY}>
        <PeriodLockCard key={lockVersion} editable={editable} />
        <PaymentApprovalCard editable={editable} />
        <FxRevaluationCard editable={editable} />
        <YearEndCloseCard editable={editable} onLockChanged={() => setLockVersion((v) => v + 1)} />
        <section className={`${CARD} p-5`}>
          <h3 className={`${CARD_TITLE} mb-2 flex items-center gap-2`}>
            <BookOpenIcon className="h-4 w-4 text-cyan-600" /> {t("Automatic postings")}
          </h3>
          <p className="mb-4 text-xs text-slate-600 dark:text-gray-300">
            Invoices, receipts, credit and debit notes, bills, vendor payments and stock movements post balanced journal
            entries by themselves. Each kind of amount goes to the account below.
            {!editable && " Only a finance administrator can change them."}
          </p>
          {loading ? (
            <p className="text-sm text-slate-400">{t("Loading...")}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-gray-800">
              {roles.map((role) => (
                <div key={role.role} className="grid gap-2 py-3 md:grid-cols-[1fr_320px] md:items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-gray-100">
                      {role.label}
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{role.requiredType.toLowerCase()}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">{USED_FOR[role.role] ? t(USED_FOR[role.role]) : null}</p>
                  </div>
                  <select
                    aria-label={`Account for ${role.label}`}
                    className={SELECT}
                    value={role.accountId}
                    disabled={!editable || saving === role.role}
                    onChange={(e) => void change(role, Number(e.target.value))}
                  >
                    {/* The current account stays listed even if it was made inactive later */}
                    {!(byType[role.requiredType] ?? []).some((a) => a.id === role.accountId) && (
                      <option value={role.accountId}>{accountLabel(role)}</option>
                    )}
                    {(byType[role.requiredType] ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
