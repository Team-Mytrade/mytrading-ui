import { useCallback, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router";
import axios from "axios";
import { Download, LogOut } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import SignIn from "../AuthPages/SignIn";
import PageLoading from "../../components/common/PageLoading";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { useCompany } from "../../company/companyApi";
import { useRegionalVersion } from "../../company/companyApi";
import { formatDate, formatMoney, todayIso } from "../../company/format";
import { CARD, CARD_TITLE, PRIMARY_BUTTON, ROW_ICON_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const PORTAL = "/v1/api/invoice/portal";
const INPUT =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 text-sm text-slate-700 dark:text-gray-200";

interface Summary { customerName: string | null; balances: { currency: string; outstanding: number; overdue: number }[]; openInvoices: number; overdueInvoices: number; creditAvailable: number }
interface InvoiceRow { id: number; invoiceNumber: string; invoiceDate: string; dueDate: string | null; currency: string; grandTotal: number; balance: number; status: string; overdue: boolean; downloadable: boolean }
interface ReceiptRow { receiptNumber: string; paymentDate: string; method: string; reference: string | null; currency: string; amount: number }
interface CreditRow { id: number; creditNoteNumber: string; date: string; invoiceNumber: string; currency: string; amount: number; reason: string | null }
interface Statement {
  openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number;
  entries: { transactionDate: string; type: string; documentNumber: string | null; description: string | null; debit: number | null; credit: number | null }[];
}
type Tab = "INVOICES" | "PAYMENTS" | "CREDITS" | "STATEMENT";

const STATUS: Record<string, string> = {
  ISSUED: "Issued", PARTIALLY_PAID: "Partly paid", PAID: "Paid", OVERDUE: "Overdue", CANCELLED: "Cancelled", VOID: "Cancelled",
};
const monthStart = () => `${todayIso().slice(0, 7)}-01`;

/** A customer's own window on their account: invoices, payments, credit notes and statement. Reading only. */
export default function CustomerPortal() {
  const { isLoggedIn, loading, access, logout } = useContext(AuthContext);
  const regional = useRegionalVersion(isLoggedIn);
  const { company } = useCompany();
  const [tab, setTab] = useState<Tab>("INVOICES");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[] | null>(null);
  const [credits, setCredits] = useState<CreditRow[] | null>(null);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayIso);
  const [statement, setStatement] = useState<Statement | null>(null);
  const portalUser = access.portalCustomerId != null;

  const load = useCallback(() => {
    const failed = (err: unknown) => ToasterService.error("Your account could not be loaded", errorText(err, "Please try again."));
    axios.get<Summary>(`${PORTAL}/summary`).then((r) => setSummary(r.data)).catch(failed);
    axios.get<InvoiceRow[]>(`${PORTAL}/invoices`).then((r) => setInvoices(r.data)).catch(() => setInvoices([]));
    axios.get<ReceiptRow[]>(`${PORTAL}/receipts`).then((r) => setReceipts(r.data)).catch(() => setReceipts([]));
    axios.get<CreditRow[]>(`${PORTAL}/credit-notes`).then((r) => setCredits(r.data)).catch(() => setCredits([]));
  }, []);

  useEffect(() => {
    if (isLoggedIn && portalUser) load();
  }, [isLoggedIn, portalUser, load]);

  const loadStatement = useCallback(() => {
    if (!from || !to || to < from) return;
    axios.get<Statement>(`${PORTAL}/statement`, { params: { from, to } }).then((r) => setStatement(r.data))
      .catch((err) => ToasterService.error("The statement could not be loaded", errorText(err, "Please try again.")));
  }, [from, to]);

  useEffect(() => {
    if (tab === "STATEMENT" && isLoggedIn && portalUser) loadStatement();
  }, [tab, isLoggedIn, portalUser, loadStatement]);

  const download = async (url: string, name: string) => {
    try {
      const { data } = await axios.get<Blob>(url, { responseType: "blob" });
      const href = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${name.replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch (err) {
      ToasterService.error("The document could not be downloaded", errorText(err, "Please try again."));
    }
  };

  if (loading) return <PageLoading />;
  if (!isLoggedIn) return <SignIn />;
  if (!portalUser) return <Navigate to="/" replace />;
  if (!regional.ready) return <PageLoading />;

  const money = (value: number | null | undefined, currency: string) => (value == null ? "—" : formatMoney(value, { currency }));
  const empty = (cols: number, text: string) => <tr><td colSpan={cols} className="px-3 py-8 text-center text-sm text-slate-400">{t(text)}</td></tr>;
  const loadingRow = (cols: number) => empty(cols, "Loading...");

  return (
    <div className="min-h-screen bg-[#eaf8fa] dark:bg-[#1f1f1f]">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#181818]">
        <div>
          <div className="text-base font-semibold text-slate-900 dark:text-white">{company?.legalName || company?.companyName}</div>
          <div className="text-xs text-slate-500">{t("Customer portal")}{summary?.customerName ? ` · ${summary.customerName}` : ""}</div>
        </div>
        <button type="button" className={SECONDARY_BUTTON} onClick={() => logout()}><LogOut className="h-4 w-4" /> {t("Sign out")}</button>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`${CARD} p-4`}>
            <div className="text-xs font-semibold text-slate-500">{t("You owe")}</div>
            {summary && summary.balances.length === 0 && <div className="mt-1 text-lg font-semibold text-emerald-700">{t("Nothing outstanding")}</div>}
            {summary?.balances.map((b) => <div key={b.currency} className="mt-1 text-lg font-semibold text-slate-800 dark:text-white">{money(b.outstanding, b.currency)}</div>)}
          </div>
          <div className={`${CARD} p-4`}>
            <div className="text-xs font-semibold text-slate-500">{t("Overdue")}</div>
            {summary?.balances.filter((b) => Number(b.overdue) > 0).map((b) => <div key={b.currency} className="mt-1 text-lg font-semibold text-rose-600">{money(b.overdue, b.currency)}</div>)}
            {summary && summary.overdueInvoices === 0 && <div className="mt-1 text-lg font-semibold text-slate-400">—</div>}
          </div>
          <div className={`${CARD} p-4`}>
            <div className="text-xs font-semibold text-slate-500">{t("Open invoices")}</div>
            <div className="mt-1 text-lg font-semibold text-slate-800 dark:text-white">{summary?.openInvoices ?? "—"}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {([["INVOICES", "Invoices"], ["PAYMENTS", "Payments"], ["CREDITS", "Credit notes"], ["STATEMENT", "Statement"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? PRIMARY_BUTTON : SECONDARY_BUTTON} onClick={() => setTab(id)}>{t(label)}</button>
          ))}
        </div>

        <div className={`${CARD} overflow-x-auto`}>
          {tab === "INVOICES" && (
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]"><tr>
                <th className={TH}>{t("Invoice")}</th><th className={TH}>{t("Date")}</th><th className={TH}>{t("Due")}</th><th className={TH}>{t("Status")}</th>
                <th className={`${TH} text-end`}>{t("Total")}</th><th className={`${TH} text-end`}>{t("Balance")}</th><th className={TH} aria-label={t("Actions")} />
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {invoices === null ? loadingRow(7) : invoices.length === 0 ? empty(7, "No invoices yet.") : invoices.map((i) => (
                  <tr key={i.id}>
                    <td className={`${TD} font-medium`}>{i.invoiceNumber}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(i.invoiceDate)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{i.dueDate ? formatDate(i.dueDate) : "—"}</td>
                    <td className={TD}>{i.overdue ? <span className="font-semibold text-rose-600">{t("Overdue")}</span> : t(STATUS[i.status] ?? i.status)}</td>
                    <td className={`${TD} whitespace-nowrap text-end`}>{money(i.grandTotal, i.currency)}</td>
                    <td className={`${TD} whitespace-nowrap text-end font-medium`}>{money(i.balance, i.currency)}</td>
                    <td className={`${TD} text-end`}>
                      {i.downloadable && <button type="button" className={ROW_ICON_BUTTON} title={t("Download PDF")} aria-label={t("Download PDF")} onClick={() => void download(`${PORTAL}/invoices/${i.id}/pdf`, i.invoiceNumber)}><Download className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "PAYMENTS" && (
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]"><tr>
                <th className={TH}>{t("Receipt")}</th><th className={TH}>{t("Date")}</th><th className={TH}>{t("Method")}</th><th className={TH}>{t("Reference")}</th><th className={`${TH} text-end`}>{t("Amount")}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {receipts === null ? loadingRow(5) : receipts.length === 0 ? empty(5, "No payments yet.") : receipts.map((r) => (
                  <tr key={r.receiptNumber}>
                    <td className={`${TD} font-medium`}>{r.receiptNumber}</td><td className={`${TD} whitespace-nowrap`}>{formatDate(r.paymentDate)}</td>
                    <td className={TD}>{r.method}</td><td className={TD}>{r.reference ?? "—"}</td><td className={`${TD} whitespace-nowrap text-end`}>{money(r.amount, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "CREDITS" && (
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]"><tr>
                <th className={TH}>{t("Credit note")}</th><th className={TH}>{t("Date")}</th><th className={TH}>{t("Invoice")}</th><th className={`${TH} text-end`}>{t("Amount")}</th><th className={TH} aria-label={t("Actions")} />
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {credits === null ? loadingRow(5) : credits.length === 0 ? empty(5, "No credit notes.") : credits.map((c) => (
                  <tr key={c.id}>
                    <td className={`${TD} font-medium`}>{c.creditNoteNumber}</td><td className={`${TD} whitespace-nowrap`}>{formatDate(c.date)}</td><td className={TD}>{c.invoiceNumber}</td>
                    <td className={`${TD} whitespace-nowrap text-end`}>{money(c.amount, c.currency)}</td>
                    <td className={`${TD} text-end`}><button type="button" className={ROW_ICON_BUTTON} title={t("Download PDF")} aria-label={t("Download PDF")} onClick={() => void download(`${PORTAL}/credit-notes/${c.id}/pdf`, c.creditNoteNumber)}><Download className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "STATEMENT" && (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={`${CARD_TITLE} me-auto`}>{t("Statement")}</h2>
                <input type="date" className={INPUT} aria-label={t("From")} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
                <input type="date" className={INPUT} aria-label={t("To")} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </div>
              {statement && (
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]"><tr>
                    <th className={TH}>{t("Date")}</th><th className={TH}>{t("Document")}</th><th className={TH}>{t("Description")}</th><th className={`${TH} text-end`}>{t("Debit")}</th><th className={`${TH} text-end`}>{t("Credit")}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    <tr className="font-medium"><td className={TD} colSpan={3}>{t("Opening balance")}</td><td className={`${TD} text-end`} colSpan={2}>{formatMoney(statement.openingBalance)}</td></tr>
                    {statement.entries.map((e, i) => (
                      <tr key={i}>
                        <td className={`${TD} whitespace-nowrap`}>{formatDate(e.transactionDate)}</td><td className={TD}>{e.documentNumber ?? "—"}</td><td className={TD}>{e.description ?? "—"}</td>
                        <td className={`${TD} whitespace-nowrap text-end`}>{Number(e.debit) ? formatMoney(e.debit as number) : ""}</td>
                        <td className={`${TD} whitespace-nowrap text-end`}>{Number(e.credit) ? formatMoney(e.credit as number) : ""}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold"><td className={TD} colSpan={3}>{t("Closing balance")}</td><td className={`${TD} text-end`} colSpan={2}>{formatMoney(statement.closingBalance)}</td></tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-500">{t("Questions about your account? Please contact {company}.", { company: company?.companyName ?? "" })}{company?.email ? ` ${company.email}` : ""}{company?.phone ? ` · ${company.phone}` : ""}</p>
      </main>
    </div>
  );
}
