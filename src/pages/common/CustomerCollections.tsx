import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Banknote, CalendarClock, ClipboardCopy, HandCoins, ListTodo } from "lucide-react";
import { ToasterService } from "../../Services/ToasterService";
import { formatDate, formatMoney, todayIso } from "../../company/format";
import { CreditChip, CustomerCredit } from "../CRM/dealCredit";
import { apiError } from "../CRM/crmShared";
import { useMyUsername } from "../CRM/crmOwnership";
import { t } from "../../i18n/i18n";

// Sales and collections in one customer view (backlog 8.4.17 / V5): what the customer owes and how late (with each
// invoice's pay-online link), the post-dated cheques still in hand, and the promises to pay the sales team logged.
// The rep logs a promise or adds a collection task here; both go into the CRM (interactions, tasks).

interface OpenInvoice {
  invoiceId: number;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  balance: number;
  companyBalance: number;
  daysLate: number;
  payLink?: string | null;
}

interface ChequeInHand {
  receiptId: number;
  receiptNumber?: string | null;
  chequeNumber?: string | null;
  bank?: string | null;
  chequeDate?: string | null;
  currency?: string | null;
  amount: number;
}

interface Promise_ {
  interactionId: number;
  promisedDate: string;
  promisedAmount: number;
  subject?: string | null;
  notes?: string | null;
  loggedAt?: string | null;
  loggedBy?: string | null;
  state: "DUE" | "TODAY" | "PASSED";
  days: number;
}

interface Collections {
  customerId: number;
  credit?: CustomerCredit | null;
  openInvoices: OpenInvoice[];
  chequesInHand: ChequeInHand[];
  promises: Promise_[];
  financeAvailable: boolean;
  // false: this person may not see finance's figures, so no amounts, invoices or cheques come (the flags still do)
  financeShown?: boolean;
}

const CARD = "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-[#333] dark:bg-[#1f1f1f]";
const TH = "px-2 py-1.5 text-start text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-2 py-1.5 text-sm text-slate-700 dark:text-gray-200";
const INPUT = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

const tomorrowAt10 = () => {
  const d = new Date(`${todayIso()}T10:00:00`);
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00:00`;
};

const promiseLabel = (p: Promise_) =>
  p.state === "TODAY" ? t("Due today")
    : p.state === "DUE" ? t("Due in {days} days", { days: String(p.days) })
      : t("Passed {days} days ago", { days: String(-p.days) });

export default function CustomerCollections({ customerId, customerName }: { customerId: number; customerName?: string }) {
  const me = useMyUsername();
  const [data, setData] = useState<Collections | null>(null);
  const [hidden, setHidden] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Collections>(`/v1/api/crm/customer-collections/${customerId}`)
      .then((res) => setData(res.data))
      // No CRM rights: this card isn't for this reader
      .catch(() => setHidden(true));
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (hidden || !data) return null;
  const credit = data.credit ?? undefined;
  const shown = data.financeShown !== false;
  const totalOverdue = data.openInvoices.filter((i) => i.daysLate > 0).reduce((s, i) => s + Number(i.companyBalance || 0), 0);
  const total = data.openInvoices.reduce((s, i) => s + Number(i.companyBalance || 0), 0);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      ToasterService.success(t("Copied"));
    } catch {
      ToasterService.info(t("Select the text and copy it"), text);
    }
  };

  const savePromise = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      ToasterService.error(t("Enter the amount the customer promised to pay"));
      return;
    }
    if (!date) {
      ToasterService.error(t("Choose the day the customer promised to pay by"));
      return;
    }
    setBusy(true);
    try {
      await axios.post(`/v1/api/crm/communications`, {
        type: "CALL",
        subject: t("Promise to pay"),
        notes: note.trim() || null,
        promisedAmount: value,
        promisedDate: date,
      }, { params: { customerId } });
      ToasterService.success(t("Promise to pay logged"));
      setPromiseOpen(false);
      setAmount("");
      setDate("");
      setNote("");
      load();
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't log the promise"));
    } finally {
      setBusy(false);
    }
  };

  const addTask = async () => {
    setBusy(true);
    try {
      const owed = formatMoney(total);
      await axios.post(`/v1/api/crm/activities`, {
        title: t("Collect payment from {name}", { name: customerName || t("the customer") }),
        description: shown ? t("Open invoices: {amount}", { amount: owed }) : t("Follow up on the open invoices"),
        activityType: "TASK",
        priority: totalOverdue > 0 ? "HIGH" : "MEDIUM",
        scheduledTime: tomorrowAt10(),
        assignedTo: me || null,
      }, { params: { customerId } });
      ToasterService.success(t("Collection task added"), t("It's in your task list for tomorrow at 10:00."));
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't add the task"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={CARD}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-[#333]">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-gray-50">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 dark:bg-cyan-400/15 dark:text-cyan-300 dark:ring-cyan-400/25">
            <HandCoins className="h-4 w-4" />
          </span>
          {t("Collections")}
          <CreditChip credit={credit} />
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => setPromiseOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-600 px-3 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:hover:bg-cyan-950/30">
            <CalendarClock className="h-3.5 w-3.5" /> {t("Log a promise to pay")}
          </button>
          <button type="button" disabled={busy} onClick={addTask}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
            <ListTodo className="h-3.5 w-3.5" /> {t("Add a collection task")}
          </button>
        </div>
      </header>

      <div className="space-y-5 p-5">
        {!shown && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-gray-300">
            {credit && credit.oldestOverdueDays > 0 && (
              <span className="me-1 font-semibold text-rose-600">
                {t("{count} invoice(s) overdue, the oldest {days} days.", {
                  count: String(credit.overdueInvoices),
                  days: String(credit.oldestOverdueDays),
                })}
              </span>
            )}
            {t("Amounts, invoices and cheques are shown to finance only.")}
          </p>
        )}
        {/* What is owed, how late, against the limit */}
        {shown && <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Owes", value: formatMoney(credit?.outstanding ?? total) },
            { label: "Overdue", value: formatMoney(credit?.overdue ?? totalOverdue), warn: (credit?.overdue ?? totalOverdue) > 0 },
            { label: "Oldest overdue", value: credit && credit.oldestOverdueDays > 0 ? t("{days} days", { days: String(credit.oldestOverdueDays) }) : "—" },
            { label: "Credit limit", value: credit?.creditLimit == null ? t("No limit") : formatMoney(credit.creditLimit), warn: !!credit?.overLimit },
          ].map((k) => (
            <div key={k.label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.04]">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t(k.label)}</dt>
              <dd className={`mt-0.5 text-sm font-bold tabular-nums ${k.warn ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>{k.value}</dd>
            </div>
          ))}
        </dl>}
        {credit?.message && <p className="text-xs text-slate-600 dark:text-gray-300">{credit.message}</p>}
        {shown && !data.financeAvailable && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {t("Finance couldn't be reached, so open invoices and cheques aren't shown right now.")}
          </p>
        )}

        {promiseOpen && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Amount promised")}</span>
                <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Promised by")}</span>
                <input type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Note (optional)")}</span>
                <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={INPUT}
                  placeholder={t("e.g. Cheque ready on Thursday")} />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setPromiseOpen(false)} disabled={busy}
                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-white dark:border-gray-700 dark:text-gray-200">
                {t("Cancel")}
              </button>
              <button type="button" onClick={savePromise} disabled={busy}
                className="h-8 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
                {t("Save promise")}
              </button>
            </div>
          </div>
        )}

        {/* Open invoices, oldest due first */}
        {shown && <div>
          <h3 className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Open invoices")}</h3>
          {data.openInvoices.length === 0 ? (
            <p className="text-xs text-slate-400">{t("Nothing owed on invoices.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#333]">
                    <th className={TH}>{t("Invoice")}</th>
                    <th className={TH}>{t("Due")}</th>
                    <th className={TH}>{t("Late")}</th>
                    <th className={`${TH} text-end`}>{t("Balance")}</th>
                    <th className={TH}>{t("Pay online")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openInvoices.slice(0, 10).map((inv) => (
                    <tr key={inv.invoiceId} className="border-b border-slate-50 last:border-0 dark:border-[#2a2a2a]">
                      <td className={`${TD} font-medium`}>{inv.invoiceNumber || `#${inv.invoiceId}`}</td>
                      <td className={TD}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                      <td className={`${TD} ${inv.daysLate > 0 ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                        {inv.daysLate > 0 ? t("{days} days", { days: String(inv.daysLate) }) : t("Not due")}
                      </td>
                      <td className={`${TD} text-end tabular-nums`}>{formatMoney(inv.balance, inv.currency || undefined)}</td>
                      <td className={TD}>
                        {inv.payLink ? (
                          <button type="button" onClick={() => copy(inv.payLink!)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">
                            <ClipboardCopy className="h-3.5 w-3.5" /> {t("Copy link")}
                          </button>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.openInvoices.length > 10 && (
                <p className="mt-1 text-[11px] text-slate-400">{t("+{count} more", { count: String(data.openInvoices.length - 10) })}</p>
              )}
            </div>
          )}
        </div>}

        <div className={`grid grid-cols-1 gap-5 ${shown ? "lg:grid-cols-2" : ""}`}>
          {/* Post-dated cheques received, not yet cleared */}
          {shown && <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200">
              <Banknote className="h-3.5 w-3.5" /> {t("Cheques in hand")}
            </h3>
            {data.chequesInHand.length === 0 ? (
              <p className="text-xs text-slate-400">{t("No post-dated cheques waiting.")}</p>
            ) : (
              <ul className="space-y-1.5">
                {data.chequesInHand.map((c) => (
                  <li key={c.receiptId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/[0.04]">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800 dark:text-gray-100">
                        {[c.chequeNumber && `${t("Cheque")} ${c.chequeNumber}`, c.bank].filter(Boolean).join(" · ") || c.receiptNumber}
                      </span>
                      <span className="block text-xs text-slate-500">{t("Dated {date}", { date: c.chequeDate ? formatDate(c.chequeDate) : "—" })}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatMoney(c.amount, c.currency || undefined)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>}

          {/* Promises to pay the sales team logged */}
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200">
              <CalendarClock className="h-3.5 w-3.5" /> {t("Promises to pay")}
            </h3>
            {data.promises.length === 0 ? (
              <p className="text-xs text-slate-400">{t("No promises logged.")}</p>
            ) : (
              <ul className="space-y-1.5">
                {data.promises.map((p) => (
                  <li key={p.interactionId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatMoney(p.promisedAmount)}</span>
                      <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${
                        p.state === "PASSED" ? "bg-rose-50 text-rose-700" : p.state === "TODAY" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {formatDate(p.promisedDate)} · {promiseLabel(p)}
                      </span>
                    </div>
                    {(p.notes || p.loggedBy) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[p.notes, p.loggedBy && t("logged by {name}", { name: p.loggedBy })].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
