import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, ChevronDown, ChevronRight, Landmark, RefreshCw } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { formatDate, formatMoney } from "../../company/format";
import { useTheme } from "../../context/ThemeContext";
import { CARD, CARD_TITLE, PAGE_BODY, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const BASE = "/v1/api/invoice/cash-flow/forecast";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

type Kind = "RECEIVABLES" | "CHEQUES_RECEIVED" | "RECURRING" | "PAYABLES" | "CHEQUES_ISSUED" | "PAYROLL";
interface Item {
  kind: Kind; id: number | null; reference: string | null; party: string | null; dueDate: string | null; expectedDate: string | null;
  week: number; currency: string; amount: number; companyAmount: number; overdue: boolean; note: string | null;
}
interface Week { week: number; from: string; to: string; opening: number; inflows: number; outflows: number; closing: number; belowMinimum: boolean; byKind: Record<string, number> }
interface Account { id: number | null; name: string; kind: string; currency: string; balance: number }
interface Forecast {
  asOf: string; until: string; currency: string; minimumBalance: number; openingBalance: number; accounts: Account[]; weeks: Week[]; items: Item[];
  totalInflows: number; totalOutflows: number; closingBalance: number; lowestBalance: number; lowestWeekFrom: string; firstWeekBelowMinimum: string | null;
  doubtful: Item[]; doubtfulTotal: number; laterInflows: number; laterOutflows: number; notes: string[];
}

const KIND: Record<Kind, string> = {
  RECEIVABLES: "Customer invoices", CHEQUES_RECEIVED: "Cheques received", RECURRING: "Recurring invoices",
  PAYABLES: "Vendor bills", CHEQUES_ISSUED: "Cheques issued", PAYROLL: "Payroll",
};
// Validated for both themes (dataviz validator): the balance in cyan, weeks under the minimum in rose (also labelled)
const COLORS = {
  light: { line: "#0891b2", below: "#e11d48", grid: "#e2e8f0", axis: "#64748b", surface: "#ffffff" },
  dark: { line: "#0891b2", below: "#f43f5e", grid: "#2a2a2a", axis: "#9ca3af", surface: "#191919" },
};

/**
 * Cash-flow forecast (backlog 7.2.3): the money in the bank and cash accounts today, then week by week from what the
 * books already expect: customer invoices (moved by how late each customer usually pays), cheques, recurring invoices,
 * vendor bills and payroll. Every amount comes from a document listed under its week.
 */
export default function CashFlowForecast() {
  const { theme } = useTheme();
  const palette = theme === "dark" ? COLORS.dark : COLORS.light;
  const [weeks, setWeeks] = useState(13);
  const [minimumInput, setMinimumInput] = useState("");
  const [minimum, setMinimum] = useState("");
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(1);

  const load = useCallback(() => {
    setLoading(true);
    axios.get<Forecast>(BASE, { params: { weeks, minimumBalance: minimum === "" ? undefined : Number(minimum) } })
      .then((r) => setForecast(r.data))
      .catch((err) => {
        setForecast(null);
        ToasterService.error(t("The cash-flow forecast could not be worked out"), apiError(err, t("Please try again.")));
      })
      .finally(() => setLoading(false));
  }, [weeks, minimum]);
  useEffect(() => { load(); }, [load]);
  // The minimum is applied once typing pauses, not on every key
  useEffect(() => {
    const timer = window.setTimeout(() => setMinimum(minimumInput), 500);
    return () => window.clearTimeout(timer);
  }, [minimumInput]);

  const money = useCallback((value: number) => formatMoney(value, { currency: forecast?.currency }), [forecast?.currency]);
  const chart = useMemo(() => (forecast?.weeks ?? []).map((w) => ({ ...w, label: formatDate(w.from) })), [forecast]);
  const itemsOf = (week: number) => (forecast?.items ?? []).filter((i) => i.week === week);

  const tile = (label: string, value: number, hint?: string, tone = "") => (
    <div className={`${CARD} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t(label)}</p>
      <p className={`mt-1 text-xl font-semibold text-slate-900 dark:text-white ${tone}`}>{money(value)}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );

  const BalanceTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: Week }[] }) => {
    if (!active || !payload?.length) return null;
    const w = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-gray-700 dark:bg-[#222222]">
        <p className="font-semibold text-slate-800 dark:text-white">{t("Week {n}", { n: w.week })} · {formatDate(w.from)} – {formatDate(w.to)}</p>
        <p className="text-slate-600 dark:text-gray-300">{t("Money in")}: {money(w.inflows)}</p>
        <p className="text-slate-600 dark:text-gray-300">{t("Money out")}: {money(w.outflows)}</p>
        <p className="font-semibold text-slate-800 dark:text-white">{t("Balance at the end")}: {money(w.closing)}</p>
        {w.belowMinimum && <p className="mt-0.5 font-semibold text-rose-600 dark:text-rose-400">{t("Below the minimum")}</p>}
      </div>
    );
  };

  return (
    <>
      <PageMeta title={t("Cash Flow Forecast")} description="Money in the bank week by week from what the books expect" />
      <PageBreadcrumb pageTitle="Cash Flow Forecast" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          {t("The money in your bank and cash accounts today, then week by week from what the books already expect: customer invoices (moved by how late each customer usually pays), cheques, recurring invoices, vendor bills and payroll. Open a week to see each amount and where it comes from.")}
        </p>

        <section className={`${CARD} flex flex-wrap items-end gap-3 p-4`}>
          <label className="w-40 text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Look ahead")}
            <select className={`${INPUT} mt-1`} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {[4, 8, 13, 26].map((n) => <option key={n} value={n}>{t("{n} weeks", { n })}</option>)}
            </select>
          </label>
          <label className="w-56 text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Keep at least (optional)")}
            <input className={`${INPUT} mt-1`} type="number" min={0} value={minimumInput} placeholder="0" onChange={(e) => setMinimumInput(e.target.value)} />
          </label>
          <button type="button" className={SECONDARY_BUTTON} onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("Work out again")}
          </button>
          {forecast && <span className="ms-auto text-xs text-slate-400">{t("{from} to {to}, in {currency}", { from: formatDate(forecast.asOf), to: formatDate(forecast.until), currency: forecast.currency })}</span>}
        </section>

        {forecast === null ? (
          <div className={`${CARD} px-3 py-6 text-center text-sm text-slate-400`}>{loading ? t("Loading...") : t("Nothing to show.")}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tile("In the bank today", forecast.openingBalance, t("{n} account(s)", { n: forecast.accounts.length }))}
              {tile("Money in", forecast.totalInflows)}
              {tile("Money out", forecast.totalOutflows)}
              {tile("At the end", forecast.closingBalance, t("lowest {amount} in the week of {date}", { amount: money(forecast.lowestBalance), date: formatDate(forecast.lowestWeekFrom) }),
                forecast.closingBalance < 0 ? "text-rose-600 dark:text-rose-400" : "")}
            </div>

            {forecast.firstWeekBelowMinimum && (
              <p className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                {t("The balance falls below {minimum} in the week of {date}. Chase the invoices due before then, or move bills and orders later.",
                  { minimum: money(forecast.minimumBalance), date: formatDate(forecast.firstWeekBelowMinimum) })}
              </p>
            )}

            <section className={`${CARD} p-4`}>
              <h2 className={CARD_TITLE}>{t("Balance at the end of each week")}</h2>
              <div className="mt-3 h-64" role="img" aria-label={t("Balance at the end of each week")}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={palette.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: palette.axis }} tickLine={false} axisLine={{ stroke: palette.grid }} />
                    <YAxis tick={{ fontSize: 11, fill: palette.axis }} tickLine={false} axisLine={false} width={90}
                      tickFormatter={(v: number) => formatMoney(v, { currency: forecast.currency, compact: true })} />
                    <Tooltip content={<BalanceTooltip />} cursor={{ stroke: palette.axis, strokeDasharray: "3 3" }} />
                    {forecast.minimumBalance !== 0 && (
                      <ReferenceLine y={forecast.minimumBalance} stroke={palette.below} strokeDasharray="4 4"
                        label={{ value: t("minimum"), position: "insideTopRight", fontSize: 11, fill: palette.axis }} />
                    )}
                    <ReferenceLine y={0} stroke={palette.axis} strokeOpacity={0.4} />
                    <Line type="linear" dataKey="closing" stroke={palette.line} strokeWidth={2} isAnimationActive={false}
                      dot={(props: { cx?: number; cy?: number; index?: number; payload?: Week }) => (
                        <circle key={props.index} cx={props.cx} cy={props.cy} r={4} stroke={palette.surface} strokeWidth={2}
                          fill={props.payload?.belowMinimum ? palette.below : palette.line} />
                      )}
                      activeDot={{ r: 6, stroke: palette.surface, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className={`${CARD} overflow-x-auto`}>
              <table className="w-full min-w-[48rem] divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Week")}</th><th className={`${TH} text-end`}>{t("Start")}</th><th className={`${TH} text-end`}>{t("Money in")}</th>
                    <th className={`${TH} text-end`}>{t("Money out")}</th><th className={`${TH} text-end`}>{t("End")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {forecast.weeks.map((w) => {
                    const expanded = open === w.week;
                    const list = itemsOf(w.week);
                    return (
                      <Fragment key={w.week}>
                        <tr className="cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50" onClick={() => setOpen(expanded ? null : w.week)}>
                          <td className={TD}>
                            <span className="flex items-center gap-1">
                              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />}
                              <span className="font-medium">{t("Week {n}", { n: w.week })}</span>
                              <span className="text-xs text-slate-400">{formatDate(w.from)} – {formatDate(w.to)}</span>
                            </span>
                          </td>
                          <td className={`${TD} text-end`}>{money(w.opening)}</td>
                          <td className={`${TD} text-end`}>{w.inflows ? money(w.inflows) : "—"}</td>
                          <td className={`${TD} text-end`}>{w.outflows ? money(w.outflows) : "—"}</td>
                          <td className={`${TD} text-end font-semibold`}>
                            {money(w.closing)}
                            {w.belowMinimum && <span className="ms-1 inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" />{t("below minimum")}</span>}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-slate-50/70 dark:bg-gray-900/40">
                            <td colSpan={5} className="px-3 pb-3 pt-1">
                              {list.length === 0 ? <p className="text-xs text-slate-500">{t("Nothing expected this week.")}</p> : (
                                <table className="w-full text-xs">
                                  <tbody>
                                    {list.map((i, n) => (
                                      <tr key={`${i.kind}-${i.id ?? n}-${n}`} className="border-t border-slate-100 first:border-t-0 dark:border-gray-800">
                                        <td className="py-1.5 pe-3 text-slate-500">{t(KIND[i.kind])}</td>
                                        <td className="py-1.5 pe-3"><span className="font-medium text-slate-700 dark:text-gray-200" dir="auto">{i.reference ?? "—"}</span>
                                          {i.party && <span className="ms-1 text-slate-500">· {i.party}</span>}</td>
                                        <td className="py-1.5 pe-3 whitespace-nowrap text-slate-500">{i.expectedDate ? formatDate(i.expectedDate) : "—"}</td>
                                        <td className="py-1.5 pe-3 text-slate-500">{i.note ? t(i.note) : ""}</td>
                                        <td className={`py-1.5 text-end font-medium whitespace-nowrap ${i.companyAmount < 0 ? "text-slate-700 dark:text-gray-200" : "text-slate-900 dark:text-white"}`}>
                                          {i.companyAmount < 0 ? "−" : "+"}{money(Math.abs(i.companyAmount))}
                                          {i.currency !== forecast.currency && <span className="block text-[11px] font-normal text-slate-400">{formatMoney(i.amount, { currency: i.currency })}</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className={`${CARD} space-y-2 p-4`}>
                <h2 className={`${CARD_TITLE} flex items-center gap-1.5`}><Landmark className="h-4 w-4 text-slate-400" />{t("Accounts today")}</h2>
                {forecast.accounts.length === 0 ? <p className="text-xs text-slate-500">{t("No bank or cash accounts yet.")}</p> : (
                  <ul className="space-y-1 text-sm">
                    {forecast.accounts.map((a, n) => (
                      <li key={a.id ?? `l${n}`} className="flex justify-between gap-2"><span className="text-slate-600 dark:text-gray-300">{a.name}</span><span className="font-medium">{money(a.balance)}</span></li>
                    ))}
                  </ul>
                )}
                {(forecast.laterInflows !== 0 || forecast.laterOutflows !== 0) && (
                  <p className="border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-gray-800">
                    {t("Expected after these weeks: {in} in and {out} out.", { in: money(forecast.laterInflows), out: money(Math.abs(forecast.laterOutflows)) })}
                  </p>
                )}
              </section>
              <section className={`${CARD} space-y-2 p-4`}>
                <h2 className={CARD_TITLE}>{t("Not counted")}</h2>
                {forecast.doubtful.length === 0 ? <p className="text-xs text-slate-500">{t("No invoices more than 90 days overdue.")}</p> : (
                  <>
                    <p className="text-xs text-slate-500">{t("Invoices more than 90 days overdue ({total}) are left out: chase them, and count them in once a date is agreed.", { total: money(forecast.doubtfulTotal) })}</p>
                    <ul className="space-y-1 text-sm">
                      {forecast.doubtful.map((d, n) => (
                        <li key={`${d.id}-${n}`} className="flex justify-between gap-2">
                          <span className="text-slate-600 dark:text-gray-300">{d.reference}{d.party ? ` · ${d.party}` : ""}<span className="block text-xs text-slate-400">{t("due {date}", { date: formatDate(d.dueDate) })}</span></span>
                          <span className="font-medium">{money(d.companyAmount)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-gray-800">
                  {t("Not in the forecast yet: VAT and social security payments, rent and other costs not entered as bills, purchase orders not billed yet, sales orders not invoiced yet, and loans.")}
                </p>
                {forecast.notes.map((note) => <p key={note} className="text-xs text-amber-700 dark:text-amber-300">{t(note)}</p>)}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
