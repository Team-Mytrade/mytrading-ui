import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { CalendarCheck, FileText, Handshake, History, MessageSquare, Receipt, ShoppingCart, Users } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { canAccessPath } from "../../access/access";
import { formatDate, formatDateTime, formatMoney, todayIso } from "../../company/format";
import { t } from "../../i18n/i18n";

// Customer 360 (backlog 8.4.2 / F1): everything about one customer on its view, each part only for those who may open
// its module: a timeline of interactions, tasks and deals; its deals, quotations, orders, invoices and payments; and
// the people you deal with there.

type TabId = "timeline" | "deals" | "quotations" | "orders" | "invoices" | "contacts";

interface Deal { id: number; dealName: string; stage: string; amount?: number | null; currencyCode?: string | null; probability?: number | null;
  expectedCloseDate?: string | null; closedOn?: string | null; ownerName?: string | null; createdDate?: string | null }
interface Activity { id: number; title: string; activityType?: string; status?: string; priority?: string; scheduledTime?: string | null;
  completedTime?: string | null; assignedTo?: string | null }
interface Interaction { id: number; type?: string; subject?: string; notes?: string | null; communicationTime?: string | null;
  promisedAmount?: number | null; promisedDate?: string | null }
interface Quotation { id: number; quoteNumber?: string; quoteDate?: string; status?: string; grandTotal?: number; currencyCode?: string }
interface Order { id: number; orderNumber?: string; orderDate?: string; status?: string; grandTotal?: number; currencyCode?: string;
  paid?: boolean; quotationNumber?: string | null }
interface RegisterRow { date: string; type: string; documentId: number; number: string; currency?: string; total: number; status?: string }
interface ReceiptRow { id: number; receiptNumber?: string; paymentDate?: string; totalAmountReceived?: number; currency?: string;
  paymentMethod?: string; chequeStatus?: string | null }
interface Contact { id: number; fullName?: string; designation?: string | null; email?: string | null; phone?: string | null;
  role?: string | null; primaryContact?: boolean | null }

const TABS: { id: TabId; label: string; icon: React.ElementType; path: string }[] = [
  { id: "timeline", label: "Timeline", icon: History, path: "/communication-history" },
  { id: "deals", label: "Deals", icon: Handshake, path: "/opportunities" },
  { id: "quotations", label: "Quotations", icon: FileText, path: "/quotations" },
  { id: "orders", label: "Sales Orders", icon: ShoppingCart, path: "/sales-orders" },
  { id: "invoices", label: "Invoices & payments", icon: Receipt, path: "/invoices" },
  { id: "contacts", label: "Contacts", icon: Users, path: "/contactPerson" },
];

const CARD = "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-[#333] dark:bg-[#1f1f1f]";
const TH = "px-2 py-1.5 text-start text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-2 py-1.5 text-sm text-slate-700 dark:text-gray-200";
const words = (code?: string | null) =>
  (code ?? "").toLowerCase().split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const listOf = <T,>(d: unknown): T[] =>
  Array.isArray(d) ? (d as T[]) : ((d as { content?: T[]; items?: T[] })?.content ?? (d as { items?: T[] })?.items ?? []);

/** Loads a list once, when its tab is first opened; null while loading, "denied" when the module refuses. */
function useList<T>(url: string | null, pick?: (data: unknown) => T[]) {
  const [rows, setRows] = useState<T[] | null | "denied">(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    axios.get(url)
      .then((res) => live && setRows(pick ? pick(res.data) : listOf<T>(res.data)))
      .catch(() => live && setRows("denied"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return rows;
}

const registerRowsOf = (data: unknown) => ((data as { rows?: RegisterRow[] })?.rows ?? []);

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-slate-400">{t(text)}</p>;
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="border-b border-slate-100 dark:border-[#333]">
            {head.map((h, i) => <th key={h} className={`${TH} ${i === head.length - 1 ? "text-end" : ""}`}>{t(h)}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function CustomerActivity({ customerId }: { customerId: number }) {
  const { access } = useContext(AuthContext);
  const tabs = TABS.filter((tab) => canAccessPath(access, tab.path));
  const [tab, setTab] = useState<TabId | null>(null);
  const shown = tab ?? tabs[0]?.id ?? null;
  // Opened tabs stay loaded
  const [opened, setOpened] = useState<Set<TabId>>(new Set());
  useEffect(() => {
    if (shown) setOpened((s) => (s.has(shown) ? s : new Set(s).add(shown)));
  }, [shown]);
  const want = (id: TabId) => opened.has(id) || shown === id;

  const canSeeTasks = canAccessPath(access, "/activities");
  const interactions = useList<Interaction>(want("timeline") ? `/v1/api/crm/communications/customer/${customerId}` : null);
  const activities = useList<Activity>(want("timeline") && canSeeTasks ? `/v1/api/crm/activities/customer/${customerId}` : null);
  const deals = useList<Deal>(want("timeline") || want("deals") ? `/v1/api/crm/deals/customer/${customerId}` : null);
  const quotations = useList<Quotation>(want("quotations") ? `/v1/api/sales/quotations/customer/${customerId}` : null);
  const orders = useList<Order>(want("orders") ? `/v1/api/sales/sales-orders/customer/${customerId}` : null);
  const from = useMemo(() => {
    const d = new Date(`${todayIso()}T00:00:00`);
    d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  }, []);
  // The register answers { rows, totals }
  const register = useList<RegisterRow>(want("invoices")
    ? `/v1/api/invoice/reports/sales/register?from=${from}&to=${todayIso()}&customerId=${customerId}` : null, registerRowsOf);
  const receipts = useList<ReceiptRow>(want("invoices") && canAccessPath(access, "/paymentReceipts")
    ? `/v1/api/invoice/receipts/customer/${customerId}` : null);
  const contacts = useList<Contact>(want("contacts") ? `/v1/api/crm/contacts/customer/${customerId}` : null);

  // Timeline: interactions, tasks and deals (opened, won, lost), newest first
  const timeline = useMemo(() => {
    if (interactions === null || deals === null) return null;
    type Item = { at: string; icon: React.ElementType; title: string; detail?: string; tone?: string };
    const items: Item[] = [];
    if (interactions !== "denied") {
      interactions.forEach((c) => c.communicationTime && items.push({
        at: c.communicationTime, icon: MessageSquare,
        title: `${t(words(c.type))}: ${c.subject ?? ""}`,
        detail: [c.promisedAmount != null && c.promisedDate
          ? t("Promised {amount} by {date}", { amount: formatMoney(c.promisedAmount), date: formatDate(c.promisedDate) }) : null,
          c.notes].filter(Boolean).join(" · ") || undefined,
        tone: c.promisedDate ? "text-cyan-700" : undefined,
      }));
    }
    if (activities && activities !== "denied") {
      activities.forEach((a) => (a.completedTime || a.scheduledTime) && items.push({
        at: (a.completedTime || a.scheduledTime)!, icon: CalendarCheck,
        title: `${t(words(a.activityType) || "Task")}: ${a.title}`,
        detail: [t(words(a.status)), a.assignedTo].filter(Boolean).join(" · "),
        tone: a.status === "COMPLETED" ? "text-emerald-700" : undefined,
      }));
    }
    if (deals !== "denied") {
      deals.forEach((d) => {
        if (d.createdDate) items.push({ at: d.createdDate, icon: Handshake, title: t("Deal opened: {name}", { name: d.dealName }),
          detail: d.amount != null ? formatMoney(d.amount, d.currencyCode || undefined) : undefined });
        if (d.closedOn) items.push({ at: `${d.closedOn}T23:59:00`, icon: Handshake,
          title: t(d.stage === "WON" ? "Deal won: {name}" : "Deal lost: {name}", { name: d.dealName }),
          tone: d.stage === "WON" ? "text-emerald-700" : "text-rose-600" });
      });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  }, [interactions, activities, deals]);

  if (tabs.length === 0) return null;

  const denied = <Empty text="You don't have access to this part." />;
  const loading = <Empty text="Loading…" />;

  return (
    <section className={CARD}>
      <div role="tablist" aria-label={t("Customer activity")}
        className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2 dark:border-[#333]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={shown === id} onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
              shown === id ? "border-cyan-600 text-cyan-700 dark:text-cyan-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400"
            }`}>
            <Icon className="h-3.5 w-3.5" /> {t(label)}
          </button>
        ))}
      </div>
      <div className="p-5">
        {shown === "timeline" && (timeline === null ? loading : timeline.length === 0 ? <Empty text="Nothing has happened with this customer yet." /> : (
          <ol className="relative space-y-3 border-s border-slate-200 ps-5 dark:border-[#333]">
            {timeline.map((item, i) => (
              <li key={i} className="relative">
                <span className="absolute -start-[29px] top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white ring-1 ring-slate-200 dark:bg-[#1f1f1f] dark:ring-[#444]">
                  <item.icon className="h-3 w-3 text-slate-500" />
                </span>
                <p className={`text-sm font-medium ${item.tone ?? "text-slate-800 dark:text-gray-100"}`}>{item.title}</p>
                <p className="text-xs text-slate-500">{formatDateTime(item.at)}{item.detail ? ` · ${item.detail}` : ""}</p>
              </li>
            ))}
          </ol>
        ))}

        {shown === "deals" && (deals === null ? loading : deals === "denied" ? denied : deals.length === 0 ? <Empty text="No deals." /> : (
          <Table head={["Deal", "Stage", "Close", "Owner", "Amount"]}>
            {deals.map((d) => (
              <tr key={d.id} className="border-b border-slate-50 last:border-0 dark:border-[#2a2a2a]">
                <td className={`${TD} font-medium`}><Link to={`/opportunities?editId=${d.id}`} className="hover:text-cyan-700 hover:underline">{d.dealName}</Link></td>
                <td className={TD}>{t(words(d.stage))}{d.probability != null && d.stage !== "WON" && d.stage !== "LOST" ? ` · ${d.probability}%` : ""}</td>
                <td className={TD}>{d.closedOn ? formatDate(d.closedOn) : d.expectedCloseDate ? formatDate(d.expectedCloseDate) : "—"}</td>
                <td className={TD}>{d.ownerName || t("Unassigned")}</td>
                <td className={`${TD} text-end tabular-nums`}>{d.amount != null ? formatMoney(d.amount, d.currencyCode || undefined) : "—"}</td>
              </tr>
            ))}
          </Table>
        ))}

        {shown === "quotations" && (quotations === null ? loading : quotations === "denied" ? denied : quotations.length === 0 ? <Empty text="No quotations." /> : (
          <Table head={["Quotation", "Date", "Status", "Total"]}>
            {quotations.map((q) => (
              <tr key={q.id} className="border-b border-slate-50 last:border-0 dark:border-[#2a2a2a]">
                <td className={`${TD} font-medium`}>{q.quoteNumber}</td>
                <td className={TD}>{q.quoteDate ? formatDate(q.quoteDate) : "—"}</td>
                <td className={TD}>{t(words(q.status))}</td>
                <td className={`${TD} text-end tabular-nums`}>{formatMoney(q.grandTotal ?? 0, q.currencyCode || undefined)}</td>
              </tr>
            ))}
          </Table>
        ))}

        {shown === "orders" && (orders === null ? loading : orders === "denied" ? denied : orders.length === 0 ? <Empty text="No sales orders." /> : (
          <Table head={["Order", "Date", "Status", "Paid", "Total"]}>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0 dark:border-[#2a2a2a]">
                <td className={`${TD} font-medium`}>{o.orderNumber}{o.quotationNumber ? <span className="block text-[11px] text-slate-400">{o.quotationNumber}</span> : null}</td>
                <td className={TD}>{o.orderDate ? formatDate(o.orderDate) : "—"}</td>
                <td className={TD}>{t(words(o.status))}</td>
                <td className={TD}>{t(o.paid ? "Yes" : "No")}</td>
                <td className={`${TD} text-end tabular-nums`}>{formatMoney(o.grandTotal ?? 0, o.currencyCode || undefined)}</td>
              </tr>
            ))}
          </Table>
        ))}

        {shown === "invoices" && (register === null ? loading : register === "denied" ? denied : (
          <div className="space-y-5">
            <div>
              <h3 className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Invoices and credit notes (last 2 years)")}</h3>
              {register.length === 0 ? <Empty text="No invoices." /> : (
                <Table head={["Document", "Date", "Type", "Total"]}>
                  {[...register].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                    <tr key={`${r.type}-${r.documentId}`} className="border-b border-slate-50 last:border-0 dark:border-[#2a2a2a]">
                      <td className={`${TD} font-medium`}>{r.number}</td>
                      <td className={TD}>{formatDate(r.date)}</td>
                      <td className={TD}>{t(words(r.type))}</td>
                      <td className={`${TD} text-end tabular-nums`}>{formatMoney(r.total, r.currency || undefined)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
            {receipts !== null && receipts !== "denied" && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Payments received")}</h3>
                {receipts.length === 0 ? <Empty text="No payments yet." /> : (
                  <Table head={["Receipt", "Date", "Method", "Amount"]}>
                    {[...receipts].sort((a, b) => (b.paymentDate ?? "").localeCompare(a.paymentDate ?? "")).map((r) => (
                      <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-[#2a2a2a]">
                        <td className={`${TD} font-medium`}>{r.receiptNumber}</td>
                        <td className={TD}>{r.paymentDate ? formatDate(r.paymentDate) : "—"}</td>
                        <td className={TD}>{t(words(r.paymentMethod))}{r.chequeStatus ? ` · ${t(words(r.chequeStatus))}` : ""}</td>
                        <td className={`${TD} text-end tabular-nums`}>{formatMoney(r.totalAmountReceived ?? 0, r.currency || undefined)}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            )}
          </div>
        ))}

        {shown === "contacts" && (contacts === null ? loading : contacts === "denied" ? denied : contacts.length === 0 ? <Empty text="No contacts." /> : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {contacts.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-[#333]">
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                  {c.fullName}{c.primaryContact ? <span className="ms-2 rounded bg-cyan-50 px-1.5 py-px text-[10px] font-semibold text-cyan-700">{t("Primary")}</span> : null}
                </p>
                <p className="text-xs text-slate-500">{[c.designation, c.role && t(words(c.role))].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-slate-600 dark:text-gray-300">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
