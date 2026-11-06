import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, CheckCircle2, Store, Wallet } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { formatDate, formatMoney } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const BASE = "/v1/api/invoice/marketplace-settlements";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Line {
  id: number; kind: "ORDER" | "REFUND" | "FEE" | "OTHER"; orderRef: string | null; salesOrderId: number | null; amount: number; description: string | null;
  invoiceId: number | null; invoiceNumber: string | null; receiptId: number | null; creditNotes: string | null; problem: string | null;
}
interface Payout {
  id: number; platform: string; storeRef: string; storeName: string | null; reference: string; periodFrom: string | null; periodTo: string | null;
  payoutDate: string | null; currency: string; payout: number; status: "DRAFT" | "POSTED"; bankAccountId: number | null; postedAt: string | null;
  postedBy: string | null; orders: number; refunds: number; fees: number; other: number; difference: number; unmatched: number; lines: Line[];
}
interface Bank { id: number; accountName: string; kind?: string; currency?: string; active?: boolean; defaultAccount?: boolean }

const PLATFORM: Record<string, string> = { AMAZON: "Amazon", NOON: "noon" };
const KIND: Record<string, string> = { ORDER: "Order", REFUND: "Refund", FEE: "Fee", OTHER: "Other" };
const TONE = {
  POSTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300",
  WARN: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

/**
 * Marketplace payouts (backlog 7.2.4 step 5): Amazon settlements and noon statements sent in from Online Stores. Each
 * order's money is matched to its invoice; posting it into the bank account records the receipts, pays refunds back
 * through credit notes and books the marketplace's fees, so the bank moves by the payout.
 */
export default function MarketplacePayouts() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const canPost = hasPermission(access, "INVOICE:APPROVE");
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [open, setOpen] = useState<Payout | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Payout[]>(BASE).then((r) => setPayouts(Array.isArray(r.data) ? r.data : [])).catch((err) => {
      setPayouts([]);
      ToasterService.error(t("Marketplace payouts could not be loaded"), apiError(err, t("Please try again.")));
    });
  }, []);
  useEffect(() => {
    load();
    axios.get<Bank[]>("/v1/api/invoice/bank-accounts").then((r) => setBanks((Array.isArray(r.data) ? r.data : []).filter((b) => b.active !== false && b.kind !== "CASH")))
      .catch(() => setBanks([]));
  }, [load]);

  const show = (p: Payout) => {
    // A draft is matched again on opening: an order invoiced since shows its invoice
    axios.get<Payout>(`${BASE}/${p.id}`).then((r) => setOpen(r.data)).catch(() => setOpen(p));
    const preferred = banks.find((b) => b.currency === p.currency) ?? banks.find((b) => b.defaultAccount);
    setBank(preferred ? String(preferred.id) : "");
  };

  const post = async (p: Payout) => {
    const bankName = banks.find((b) => String(b.id) === bank)?.accountName ?? t("the default bank account");
    if (!window.confirm(t("Post payout {ref} of {amount} into {bank}? Its orders are paid, its refunds credited and paid back, and its fees booked.",
      { ref: p.reference, amount: formatMoney(p.payout, { currency: p.currency }), bank: bankName }))) return;
    setBusy(true);
    try {
      const { data } = await axios.post<Payout>(`${BASE}/${p.id}/post`, { bankAccountId: bank ? Number(bank) : null });
      setOpen(data);
      load();
      ToasterService.success(t("Payout posted"), t("{ref}: receipts, refunds and fees are in the books.", { ref: data.reference }));
    } catch (err) {
      ToasterService.error(t("The payout could not be posted"), apiError(err, t("Please try again.")));
    } finally {
      setBusy(false);
    }
  };

  const money = (value: number, currency: string) => formatMoney(value, { currency });

  return (
    <>
      <PageMeta title={t("Marketplace Payouts")} description="Amazon and noon payouts matched to invoices and posted" />
      <PageBreadcrumb pageTitle="Marketplace Payouts" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          {t("Payouts from Amazon and noon, sent in from Online Stores. Each order's money is matched to its invoice; posting puts the receipts, refunds and fees into the bank account the marketplace pays, so the bank moves by the payout.")}
        </p>

        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[60rem] divide-y divide-slate-100 dark:divide-gray-800">
            <thead className="bg-slate-50 dark:bg-[#222222]">
              <tr>
                <th className={TH}>{t("Marketplace")}</th><th className={TH}>{t("Payout")}</th><th className={TH}>{t("Period")}</th>
                <th className={TH}>{t("Paid on")}</th><th className={`${TH} text-end`}>{t("Orders")}</th><th className={`${TH} text-end`}>{t("Refunds")}</th>
                <th className={`${TH} text-end`}>{t("Fees and other")}</th><th className={`${TH} text-end`}>{t("Paid out")}</th><th className={TH}>{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {payouts === null ? <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                : payouts.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                    {t("No payouts yet. On Online Stores, use Get payouts for Amazon or Upload payout statement for noon.")}{" "}
                    <button type="button" className="underline decoration-dotted" onClick={() => navigate("/sales-online-stores")}>{t("Online Stores")}</button>
                  </td></tr>
                ) : payouts.map((p) => (
                  <tr key={p.id} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50 ${open?.id === p.id ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`} onClick={() => show(p)}>
                    <td className={TD}><span className="font-medium">{PLATFORM[p.platform] ?? p.platform}</span><span className="block text-xs text-slate-400">{p.storeName ?? p.storeRef}</span></td>
                    <td className={`${TD} font-mono text-xs`} dir="ltr">{p.reference}</td>
                    <td className={`${TD} whitespace-nowrap text-xs`}>{p.periodFrom ? formatDate(p.periodFrom) : "—"} – {p.periodTo ? formatDate(p.periodTo) : "—"}</td>
                    <td className={`${TD} whitespace-nowrap`}>{p.payoutDate ? formatDate(p.payoutDate) : "—"}</td>
                    <td className={`${TD} whitespace-nowrap text-end`}>{money(p.orders, p.currency)}</td>
                    <td className={`${TD} whitespace-nowrap text-end`}>{money(p.refunds, p.currency)}</td>
                    <td className={`${TD} whitespace-nowrap text-end`}>{money(p.fees + p.other, p.currency)}</td>
                    <td className={`${TD} whitespace-nowrap text-end font-semibold`}>{money(p.payout, p.currency)}</td>
                    <td className={TD}>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === "POSTED" ? TONE.POSTED : p.unmatched || p.difference ? TONE.WARN : TONE.DRAFT}`}>
                        {p.status === "POSTED" ? t("Posted") : p.unmatched ? t("{n} to match", { n: p.unmatched }) : p.difference ? t("Doesn't add up") : t("Ready to post")}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {open && (
          <section className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-[rgb(var(--brand-600,0_151_167))]" />
                <div>
                  <h2 className={CARD_TITLE}>{PLATFORM[open.platform] ?? open.platform} {t("payout")} <span className="font-mono text-xs font-normal text-slate-400" dir="ltr">{open.reference}</span></h2>
                  <p className="text-xs text-slate-500">
                    {money(open.payout, open.currency)} · {open.payoutDate ? formatDate(open.payoutDate) : "—"}
                    {open.status === "POSTED" && open.postedAt ? ` · ${t("posted")} ${formatDate(open.postedAt.slice(0, 10))}` : ""}
                  </p>
                </div>
              </div>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(null)}>{t("Close")}</button>
            </div>
            {open.difference !== 0 && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                {t("The lines are {diff} away from the amount paid out: something the marketplace reported isn't here. Check the payout in its seller portal; it can't be posted until they add up.", { diff: money(open.difference, open.currency) })}
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
              <table className="w-full min-w-[52rem] divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr><th className={TH}>{t("Line")}</th><th className={TH}>{t("Order")}</th><th className={`${TH} text-end`}>{t("Amount")}</th><th className={TH}>{t("Invoice")}</th><th className={TH}>{t("In the books")}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {open.lines.map((l) => (
                    <tr key={l.id}>
                      <td className={TD}>{t(KIND[l.kind])}<span className="block text-xs text-slate-400">{l.description}</span></td>
                      <td className={`${TD} font-mono text-xs`} dir="ltr">{l.orderRef ?? "—"}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>{money(l.amount, open.currency)}</td>
                      <td className={TD}>
                        {l.invoiceNumber ?? "—"}
                        {l.problem && <span className="mt-1 block max-w-sm text-xs text-amber-700">{l.problem}</span>}
                      </td>
                      <td className={`${TD} text-xs`}>
                        {l.receiptId ? t("Receipt") : l.creditNotes ? `${t("Credit note")} ${l.creditNotes}` : open.status === "POSTED" && (l.kind === "FEE" || l.kind === "OTHER") ? t("Marketplace fees") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {open.status === "DRAFT" && canPost && (
              <div className="flex flex-wrap items-end justify-end gap-2">
                <div className="min-w-[16rem]">
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300" htmlFor="mp-bank">{t("Paid into")}</label>
                  <select id="mp-bank" className={INPUT} value={bank} onChange={(e) => setBank(e.target.value)}>
                    <option value="">{t("The default bank account")}</option>
                    {banks.map((b) => <option key={b.id} value={String(b.id)}>{b.accountName}{b.currency ? ` (${b.currency})` : ""}</option>)}
                  </select>
                </div>
                <button type="button" className={PRIMARY_BUTTON} disabled={busy || open.unmatched > 0 || open.difference !== 0} onClick={() => post(open)}>
                  <Wallet className="h-4 w-4" /> {t("Post payout")}
                </button>
              </div>
            )}
            {open.status === "POSTED" && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{t("Posted: the receipts, refunds and fees are in the books.")}</p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
