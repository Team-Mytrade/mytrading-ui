import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE, TOOL_BUTTON } from "./hrmsUi";
import { money, monthLabel } from "./taxTracker";
import { downloadStatementPdf } from "./statementPdf";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

interface Slab {
  from: number;
  to?: number | null;
  rate: number;
  income: number;
  tax: number;
}

interface RegimeSide {
  regime: "NEW" | "OLD";
  hraExemption: number;
  section80c: number;
  otherDeductions: number;
  professionalTax: number;
  deductions: number;
  standardDeduction: number;
  taxableIncome: number;
  rebate: number;
  tax: number;
}

interface Comparison {
  chosen?: string | null;
  newRegime: RegimeSide;
  oldRegime: RegimeSide;
  lower?: "NEW" | "OLD" | null;
  difference: number;
}

interface TaxStatementData {
  financialYear: string;
  source: "FORECAST" | "LAST_RUN" | "NONE";
  month?: string | null;
  regime?: string | null;
  monthsLeft: number;
  paidSoFar?: number | null;
  thisMonth?: number | null;
  restOfYear?: number | null;
  projectedIncome?: number | null;
  hraExemption?: number | null;
  section80c?: number | null;
  otherDeductions?: number | null;
  professionalTax?: number | null;
  deductions?: number | null;
  standardDeduction?: number | null;
  taxableIncome?: number | null;
  slabs: Slab[];
  slabTax?: number | null;
  rebate?: number | null;
  surcharge?: number | null;
  cess?: number | null;
  taxForYear?: number | null;
  deductedSoFar?: number | null;
  leftToDeduct?: number | null;
  perMonth?: number | null;
  deductedThisYear?: number | null;
  comparison?: Comparison | null;
}

const API = "/v1/api/payroll/statements/tax";
const n = (v?: number | null) => Number(v) || 0;
const lakh = (v: number) => (v >= 100000 ? `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L` : money(v));

const Metric: React.FC<{ label: string; value: string; note?: React.ReactNode; accent?: boolean }> = ({ label, value, note, accent }) => (
  <div className={`${CARD} p-3 ${accent ? "ring-1 ring-cyan-200 dark:ring-cyan-900" : ""}`}>
    <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
    <div className={`mt-0.5 text-xl font-semibold tabular-nums ${accent ? "text-cyan-700 dark:text-cyan-300" : "text-slate-900 dark:text-white"}`}>{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>}
  </div>
);

/** One step of the working: a number on the right, its detail below when opened. */
const Step: React.FC<{ index?: string; label: string; value: string; detail?: React.ReactNode; tone?: "total" | "result" | "muted" }> = ({ index, label, value, detail, tone }) => {
  const [open, setOpen] = useState(false);
  const rowTone = tone === "result" ? "bg-cyan-50 font-semibold text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
    : tone === "total" ? "bg-slate-50 font-semibold text-slate-900 dark:bg-[#222] dark:text-white"
    : tone === "muted" ? "text-slate-400 dark:text-gray-500" : "text-slate-700 dark:text-gray-300";
  return (
    <div className="border-b border-slate-100 last:border-b-0 dark:border-gray-800">
      <button type="button" disabled={!detail} onClick={() => setOpen((o) => !o)} aria-expanded={detail ? open : undefined}
        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${rowTone} ${detail ? "hover:bg-slate-50 dark:hover:bg-[#222]" : "cursor-default"}`}>
        <span className="flex items-center gap-2">
          <span className="w-4 text-slate-400">{detail ? (open ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />) : null}</span>
          {index && <span className="w-4 text-xs text-slate-400">{index}</span>}
          {label}
        </span>
        <span className="tabular-nums">{value}</span>
      </button>
      {open && detail && <div className="bg-slate-50/60 px-4 pb-3 pl-14 pt-1 text-xs text-slate-600 dark:bg-[#1c1c1c] dark:text-gray-400">{detail}</div>}
    </div>
  );
};

/**
 * Old and new regime side by side on the same income: deductions, taxable income, rebate, tax; the regime the
 * employee is on, which costs less and by how much. The old side counts approved declarations only.
 */
const RegimeCompare: React.FC<{ c: Comparison; own: boolean }> = ({ c, own }) => {
  const sides = [c.newRegime, c.oldRegime];
  const label = (r: string) => (r === "NEW" ? t("New regime") : t("Old regime"));
  const rows: { label: string; value: (s: RegimeSide) => string; detail?: boolean }[] = [
    { label: t("HRA exemption"), value: (s) => (s.regime === "NEW" ? "—" : money(s.hraExemption)), detail: true },
    { label: t("80C (your PF included)"), value: (s) => (s.regime === "NEW" ? "—" : money(s.section80c)), detail: true },
    { label: t("Other sections"), value: (s) => (s.regime === "NEW" ? "—" : money(s.otherDeductions)), detail: true },
    { label: t("Professional tax"), value: (s) => (s.regime === "NEW" ? "—" : money(s.professionalTax)), detail: true },
    { label: t("Standard deduction"), value: (s) => money(s.standardDeduction) },
    { label: t("Taxable income"), value: (s) => money(s.taxableIncome) },
    { label: t("Rebate (87A)"), value: (s) => (s.rebate > 0 ? `− ${money(s.rebate)}` : "—") },
  ];
  const onLower = c.lower == null || c.lower === c.chosen;
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
        <div className={CARD_TITLE}>{t("Old and new regime compared")}</div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${onLower
          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900"
          : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"}`}>
          {c.lower == null ? t("Both regimes cost the same")
            : onLower ? `${label(c.chosen ?? c.lower)} ${t("costs less by")} ${money(c.difference)} ${t("a year")}`
            : `${label(c.lower)} ${t("would cost")} ${money(c.difference)} ${t("less a year")}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#222]">
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-gray-400" />
              {sides.map((s) => (
                <th key={s.regime} className={`px-4 py-2 text-right text-[11px] font-semibold ${s.regime === c.chosen ? "text-cyan-700 dark:text-cyan-300" : "text-slate-500 dark:text-gray-400"}`}>
                  {label(s.regime)}
                  {s.regime === c.chosen && <span className="ml-1.5 rounded bg-cyan-50 px-1 text-[10px] font-medium text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{own ? t("yours") : t("chosen")}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.label} className={r.detail ? "text-slate-500 dark:text-gray-400" : "text-slate-700 dark:text-gray-300"}>
                <td className={`px-4 py-1.5 ${r.detail ? "pl-7" : ""}`}>{r.label}</td>
                {sides.map((s) => <td key={s.regime} className="px-4 py-1.5 text-right tabular-nums">{r.value(s)}</td>)}
              </tr>
            ))}
            <tr className="font-semibold text-slate-900 dark:text-white">
              <td className="px-4 py-2">{t("Tax for the year")}</td>
              {sides.map((s) => (
                <td key={s.regime} className={`px-4 py-2 text-right tabular-nums ${s.regime === c.lower ? "text-green-700 dark:text-green-400" : ""}`}>{money(s.tax)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
        {t("Same income for both. The old regime counts approved declarations only: rent, 80C, 80D and others still to be approved would lower it further.")}
        {own && <> {t("The regime is chosen on your")} <Link to="/it-declaration" className="font-medium text-cyan-700 hover:underline dark:text-cyan-300">{t("IT declaration")}</Link>.</>}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className={`flex justify-between gap-3 py-0.5 ${strong ? "font-semibold text-slate-800 dark:text-gray-200" : ""}`}>
    <span>{label}</span><span className="tabular-nums">{value}</span>
  </div>
);

/**
 * The income tax statement (docs/PAYROLL-STATEMENTS.md §3.3): five cards — regime, taxable income, tax for the year,
 * deducted so far, per month from now — and the working as a waterfall, each step opening its detail (the slabs line
 * by line, the deductions). It is the working payroll uses, so the next month's deduction is the one shown.
 */
const TaxStatement: React.FC<{ employeeId: string; fy: string }> = ({ employeeId, fy }) => {
  const own = employeeId === "me";
  const [data, setData] = useState<TaxStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get<TaxStatementData>(`${API}/${employeeId}`, { params: fy ? { fy } : {} })
      .then((res) => setData(res.data ?? null))
      .catch((err) => {
        setData(null);
        setError(apiError(err, "The income tax statement could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [employeeId, fy]);

  if (loading && !data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>;
  if (!data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{error ?? t("The income tax statement could not be loaded.")}</div>;
  if (data.source === "NONE") {
    return (
      <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>
        {t("No working is available for this year: its payroll ran before MyTrade kept the tax working.")}
        {n(data.deductedThisYear) > 0 && <div className="mt-1">{t("Tax deducted this year")}: <span className="font-semibold text-slate-800 dark:text-gray-200">{money(data.deductedThisYear)}</span></div>}
      </div>
    );
  }

  const old = data.regime === "OLD";
  const done = n(data.taxForYear) > 0 ? Math.min(100, Math.round((n(data.deductedSoFar) / n(data.taxForYear)) * 100)) : 100;
  const forecast = data.source === "FORECAST";
  const asOf = data.month ? monthLabel(data.month) : "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label={t("Regime")} value={old ? t("Old") : t("New")} note={old ? t("Deductions and exemptions count") : t("Lower slabs, no deductions")} />
        <Metric label={t("Taxable income")} value={money(data.taxableIncome)} note={lakh(n(data.taxableIncome))} />
        <Metric label={t("Tax for the year")} value={money(data.taxForYear)} />
        <Metric label={t("Deducted so far")} value={money(data.deductedSoFar)} note={
          <span className="mt-1 flex items-center gap-2">
            <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800"><span className="absolute inset-y-0 left-0 rounded-full bg-cyan-600" style={{ width: `${done}%` }} /></span>
            {done}% {t("done")}
          </span>} />
        <Metric accent label={t("Per month from now")} value={money(data.perMonth)} note={`${data.monthsLeft} ${t(data.monthsLeft === 1 ? "month left" : "months left")}`} />
      </div>

      {data.comparison && <RegimeCompare c={data.comparison} own={own} />}

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
          <div className={CARD_TITLE}>{t("How your tax is worked out")} · FY {data.financialYear}</div>
          <span className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 dark:text-gray-400">
              {forecast ? `${t("As payroll will work out")} ${asOf}` : `${t("As worked out for")} ${asOf}`}
            </span>
            <button type="button" className={TOOL_BUTTON} onClick={() => downloadStatementPdf("tax", employeeId, data.financialYear)}>
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />{t("PDF")}
            </button>
            <button type="button" className={TOOL_BUTTON} onClick={() => downloadStatementPdf("form16", employeeId, data.financialYear)}
              title={t("Form 16: Part A (tax deducted and deposited) and Part B (salary and tax), from the year's payroll")}>
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />{t("Form 16")}
            </button>
          </span>
        </div>
        <Step index="1" label={t("Salary income for the year")} value={money(data.projectedIncome)} detail={
          <>
            <Row label={t("Paid so far this year")} value={money(data.paidSoFar)} />
            <Row label={`${forecast ? t("This month") : asOf}`} value={money(data.thisMonth)} />
            <Row label={`${t("Rest of the year")} (${Math.max(0, data.monthsLeft - (forecast ? 1 : 0))} ${t("months at today's salary")})`} value={money(data.restOfYear)} />
            <Row strong label={t("Total")} value={money(data.projectedIncome)} />
            <div className="mt-1 text-slate-400">{t("Paid so far includes months from the old system and any previous employer's salary this year (Form 12B).")}</div>
          </>
        } />
        {old ? (
          <>
            <Step index="2" label={t("Less HRA exemption")} value={`− ${money(data.hraExemption)}`} detail={
              <div>{t("The least of the HRA received, rent paid less 10% of basic, and 50% of basic (40% outside a metro), from the approved rent declaration.")}</div>
            } />
            <Step index="3" label={t("Less deductions (80C, 80D…)")} value={`− ${money(n(data.section80c) + n(data.otherDeductions))}`} detail={
              <>
                <Row label={t("Section 80C, your PF included (up to ₹1,50,000)")} value={money(data.section80c)} />
                <Row label={t("Other sections (approved declarations)")} value={money(data.otherDeductions)} />
              </>
            } />
            <Step index="4" label={t("Less professional tax")} value={`− ${money(data.professionalTax)}`} />
          </>
        ) : (
          <Step index="2" label={t("Exemptions and deductions")} value={t("not in the new regime")} tone="muted" />
        )}
        <Step index={old ? "5" : "3"} label={t("Less standard deduction")} value={`− ${money(data.standardDeduction)}`} />
        <Step label={t("Taxable income")} value={money(data.taxableIncome)} tone="total" />
        <Step index={old ? "6" : "4"} label={t("Tax on the slabs")} value={money(data.slabTax)} detail={
          <table className="w-full max-w-md">
            <tbody>
              {data.slabs.map((s, i) => (
                <tr key={i} className={n(s.income) > 0 ? "" : "text-slate-400 dark:text-gray-600"}>
                  <td className="py-0.5 pr-3">{s.to == null ? `${t("Above")} ${lakh(n(s.from))}` : `${lakh(n(s.from))} – ${lakh(n(s.to))}`}</td>
                  <td className="py-0.5 pr-3 text-right tabular-nums">{Math.round(n(s.rate) * 100)}%</td>
                  <td className="py-0.5 pr-3 text-right tabular-nums">{money(s.income)}</td>
                  <td className="py-0.5 text-right tabular-nums">{money(s.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        } />
        {n(data.rebate) > 0 && <Step label={t("Less rebate (section 87A)")} value={`− ${money(data.rebate)}`} />}
        {n(data.surcharge) > 0 && <Step label={t("Plus surcharge")} value={money(data.surcharge)} />}
        <Step label={t("Plus health and education cess (4%)")} value={money(data.cess)} />
        <Step label={t("Tax for the year")} value={money(data.taxForYear)} tone="total" />
        <Step label={t("Less deducted so far")} value={`− ${money(data.deductedSoFar)}`} detail={
          <div>{t("Tax deducted by MyTrade's payroll this year, plus any from the old system and a previous employer this year.")}</div>
        } />
        <Step label={`${t("Left to deduct")} · ${money(data.perMonth)} ${t("a month over")} ${data.monthsLeft} ${t(data.monthsLeft === 1 ? "month" : "months")}`} value={money(data.leftToDeduct)} tone="result" />
        <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {t("The rest of the year is at today's salary; a one-off (bonus) is taxed in the month it is paid. Declarations count once approved.")}
        </div>
      </div>
    </div>
  );
};

export default TaxStatement;
