import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, DocumentArrowDownIcon, EyeIcon, FolderArrowDownIcon, MinusIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PayslipPreviewModal from "../../components/Payroll/PayslipPreviewModal";
import PayslipZipDialog from "../../components/Payroll/PayslipZipDialog";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import { CARD, CARD_TITLE, PAGE_BODY, TOOL_BUTTON } from "./hrmsUi";
import ToolbarSelect from "../../components/common/ToolbarSelect";
import { t } from "../../i18n/i18n";
import { RegimePill } from "./TaxTrackerPage";
import { EmployeeTaxDetail, MonthLine, SalaryStructure, TAX_TRACKER_API, chartColors, initials, isDarkTheme, money, monthLabel, paidShare } from "./taxTracker";

// Payslip downloads ask for a blob, so an error's JSON body arrives as one too
const blobError = async (err: unknown, fallback: string) => {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      return body.message || body.error || fallback;
    } catch {
      return fallback;
    }
  }
  return apiError(err, fallback);
};

const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-gray-700 dark:bg-[#191919] dark:text-gray-300 dark:hover:bg-cyan-950/40";

// A small wave that rises (tax went up) or falls (tax went down), ending in an arrow head
const Wave: React.FC<{ up: boolean }> = ({ up }) => (
  <svg width="14" height="10" viewBox="0 0 16 12" aria-hidden="true" className="shrink-0">
    <path d={up ? "M1 10 C4 10 4 4 7 6 S11 3 13 2" : "M1 2 C4 2 4 8 7 6 S11 9 13 10"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d={up ? "M10 1.5 L13.5 1.5 L13.5 5" : "M10 10.5 L13.5 10.5 L13.5 7"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CHIP = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium";
const NEUTRAL = "bg-slate-100 text-slate-600 dark:bg-[#222222] dark:text-gray-300";

/** How the month's tax compares with the month before: red wave up, green wave down, gray for no change. */
const ChangeChip: React.FC<{ tax: number; previous: MonthLine | null }> = ({ tax, previous }) => {
  if (!previous) return <span className={`${CHIP} ${NEUTRAL}`}>{t("First")}</span>;
  const before = Number(previous.incomeTax) || 0;
  const diff = Math.round((Number(tax) || 0) - before);
  if (diff === 0) {
    return <span className={`${CHIP} ${NEUTRAL}`} title={`${t("Same as")} ${monthLabel(previous.month)}`}><MinusIcon className="h-3 w-3" aria-hidden="true" />{t("Same")}</span>;
  }
  const up = diff > 0;
  const share = before > 0 ? (Math.abs(diff) / before) * 100 : 0;
  return (
    <span className={`${CHIP} ${up ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300" : "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"}`}
      title={`${up ? t("More than") : t("Less than")} ${monthLabel(previous.month)} (${money(before)})${share >= 0.1 ? ` · ${share.toFixed(1)}%` : ""}`}>
      <Wave up={up} />{money(Math.abs(diff))}
      <span className="sr-only"> {up ? t("more than") : t("less than")} {monthLabel(previous.month)}</span>
    </span>
  );
};

/** How the month's take-home compares with the month before: green wave up (more pay), red wave down (less). */
const TakeHomeChip: React.FC<{ takeHome: number; previous: MonthLine | null; size?: "sm" | "md" }> = ({ takeHome, previous, size = "sm" }) => {
  if (!previous) return null;
  const before = Number(previous.takeHome) || 0;
  const diff = Math.round((Number(takeHome) || 0) - before);
  const text = size === "md" ? "text-[11px]" : "text-[10.5px]";
  if (diff === 0) {
    return <span className={`${CHIP} ${text} ${NEUTRAL}`} title={`${t("Take-home same as")} ${monthLabel(previous.month)}`}><MinusIcon className="h-3 w-3" aria-hidden="true" />{t("Same")}</span>;
  }
  const up = diff > 0;
  return (
    <span className={`${CHIP} ${text} ${up ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"}`}
      title={`${t("Take-home")} ${up ? t("up") : t("down")} ${money(Math.abs(diff))} ${t("from")} ${monthLabel(previous.month)} (${money(before)})`}>
      <Wave up={up} />{money(Math.abs(diff))}
      <span className="sr-only"> {up ? t("more take-home than") : t("less take-home than")} {monthLabel(previous.month)}</span>
    </span>
  );
};

/** One month as a small tile: the tax, its change, paid (solid) or forecast (dashed); click to show the month. */
const TaxTile: React.FC<{ line: MonthLine; previous: MonthLine | null; selected: boolean; onSelect: () => void }> = ({ line, previous, selected, onSelect }) => {
  const forecast = line.status === "FORECAST";
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={`flex flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${forecast ? "border-dashed" : ""} ${selected ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30" : "border-slate-200 bg-white hover:border-cyan-300 dark:border-gray-700 dark:bg-[#191919]"}`}>
      <span className="flex w-full items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
        {monthLabel(line.month, true)}
        {line.payslipAvailable && <DocumentArrowDownIcon className="h-3 w-3 text-cyan-600" aria-label={t("Payslip available")} />}
      </span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{money(line.incomeTax)}</span>
      <ChangeChip tax={line.incomeTax} previous={previous} />
      <span className="mt-0.5 flex w-full flex-wrap items-center gap-1 border-t border-slate-100 pt-1 text-[10.5px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
        <span className="tabular-nums">{t("Take-home")} {money(line.takeHome)}</span>
        <TakeHomeChip takeHome={line.takeHome} previous={previous} />
      </span>
    </button>
  );
};

const Row: React.FC<{ label: React.ReactNode; value: string; strong?: boolean; muted?: boolean; topLine?: boolean }> = ({ label, value, strong, muted, topLine }) => (
  <div className={`flex items-center justify-between gap-3 py-1 text-sm ${topLine ? "mt-1 border-t border-slate-100 pt-2 dark:border-gray-800" : ""} ${strong ? "font-semibold text-slate-900 dark:text-white" : muted ? "text-slate-500 dark:text-gray-400" : "text-slate-700 dark:text-gray-200"}`}>
    <span className="min-w-0">{label}</span>
    <span className="shrink-0 tabular-nums">{value}</span>
  </div>
);

// One hue, light to dark, for the CTC parts (a single measure split into parts); employer-side parts in gray
const CTC_SHADES = ["#2a78d6", "#5e9be3", "#93bdee", "#c3dbf6", "#dbe9f9"];
const EMPLOYER_SHADE = "#9ca3af";

const Swatch: React.FC<{ color: string }> = ({ color }) => (
  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: color }} aria-hidden="true" />
);

/** What the CTC is made of, as a bar and its lines. */
const CtcCard: React.FC<{ salary: SalaryStructure }> = ({ salary }) => {
  const parts = [
    ...salary.fixedPay.map((l, i) => ({ name: l.name, yearly: Number(l.yearly), color: CTC_SHADES[Math.min(i, CTC_SHADES.length - 1)] })),
    ...(salary.employerPfInCtc && salary.employerPfYearly > 0 ? [{ name: t("Employer PF"), yearly: Number(salary.employerPfYearly), color: EMPLOYER_SHADE }] : []),
    ...salary.employerBenefits.map((l) => ({ name: l.name, yearly: Number(l.yearly), color: EMPLOYER_SHADE })),
  ];
  const whole = parts.reduce((a, p) => a + p.yearly, 0) || 1;
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-2 flex items-baseline justify-between">
        <div className={CARD_TITLE}>{t("CTC breakdown")}</div>
        <span className="text-xs text-slate-500 dark:text-gray-400">{t("yearly")}</span>
      </div>
      <div className="mb-3 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img"
        aria-label={parts.map((p) => `${p.name} ${money(p.yearly)}`).join(", ")}>
        {parts.map((p) => <div key={p.name} style={{ width: `${(p.yearly / whole) * 100}%`, background: p.color }} title={`${p.name}: ${money(p.yearly)}`} />)}
      </div>
      {salary.fixedPay.map((l, i) => (
        <Row key={l.name} label={<><Swatch color={CTC_SHADES[Math.min(i, CTC_SHADES.length - 1)]} />{l.name}</>} value={money(l.yearly)} />
      ))}
      <Row label={t("Fixed pay")} value={money(salary.fixedPayTotal)} strong topLine />
      {salary.employerPfYearly > 0 && (
        <Row muted label={<><Swatch color={EMPLOYER_SHADE} />{salary.employerPfInCtc ? t("Employer PF (in CTC, paid to EPFO)") : t("Employer PF (on top of CTC)")}</>}
          value={`${salary.employerPfInCtc ? "" : "+ "}${money(salary.employerPfYearly)}`} />
      )}
      {salary.employerBenefits.map((l) => (
        <Row key={l.name} muted label={<><Swatch color={EMPLOYER_SHADE} />{l.name}</>} value={money(l.yearly)} />
      ))}
      <Row label={t("Total CTC")} value={money(salary.ctc)} strong topLine />
      {!salary.employerPfInCtc && salary.employerPfYearly > 0 && <Row label={t("Cost to company")} value={money(salary.costToCompany)} muted />}
      {salary.variablePayTarget > 0 && <Row muted label={t("Variable pay target (on top, paid separately)")} value={money(salary.variablePayTarget)} />}
    </div>
  );
};

/** One month's pay: gross, deductions, take-home, the employer's share, with its payslip. */
const MonthPayCard: React.FC<{ line: MonthLine; previous: MonthLine | null; onPreview: () => void; onDownload: () => void }> = ({ line, previous, onPreview, onDownload }) => {
  const forecast = line.status === "FORECAST";
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className={CARD_TITLE}>
          {t("A month's pay")} <span className="font-normal text-slate-500 dark:text-gray-400">({monthLabel(line.month)}{forecast ? `, ${t("forecast")}` : ""})</span>
        </div>
        {line.payslipAvailable && (
          <div className="flex gap-1.5">
            <button type="button" className={ICON_BUTTON} onClick={onPreview} title={t("View payslip")} aria-label={`${t("View payslip")} ${monthLabel(line.month)}`}>
              <EyeIcon className="h-4 w-4" />
            </button>
            <button type="button" className={ICON_BUTTON} onClick={onDownload} title={t("Download payslip")} aria-label={`${t("Download payslip")} ${monthLabel(line.month)}`}>
              <DocumentArrowDownIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <Row label={t("Gross pay")} value={money(line.grossPay)} />
      <Row muted label={t("Provident fund (you)")} value={`− ${money(line.providentFund)}`} />
      {line.esi > 0 && <Row muted label={t("ESI (you)")} value={`− ${money(line.esi)}`} />}
      {line.professionalTax > 0 && <Row muted label={t("Professional tax")} value={`− ${money(line.professionalTax)}`} />}
      {line.otherDeductions > 0 && <Row muted label={t("Other deductions")} value={`− ${money(line.otherDeductions)}`} />}
      <Row muted label={t("Income tax")} value={`− ${money(line.incomeTax)}`} />
      <Row label={<span className="inline-flex items-center gap-2">{t("Take-home")}<TakeHomeChip takeHome={line.takeHome} previous={previous} size="md" /></span>}
        value={money(line.takeHome)} strong topLine />
      {(line.employerPf > 0 || line.employerEsi > 0) && (
        <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
          {t("Your employer adds")} {[line.employerPf > 0 ? `PF ${money(line.employerPf)}` : "", line.employerEsi > 0 ? `ESI ${money(line.employerEsi)}` : ""].filter(Boolean).join(" · ")} {t("(not deducted from your pay)")}
        </p>
      )}
      {!forecast && !line.payslipAvailable && <p className="mt-2 text-xs text-slate-400">{t("No payslip for this month yet")}</p>}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className={`${CARD} p-3`}>
    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</div>
    <div className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>}
  </div>
);

/**
 * An employee's salary for the financial year: the CTC and what it's made of, a month's pay with its payslip, and
 * the income tax month by month (paid and forecast). "My Salary" for the employee (/mySalary); HR opens anyone's
 * from the Tax Tracker (/taxTracker/:id).
 */
const TaxTrackerEmployeePage: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { canApprove } = usePermissions();
  // No id or "me": the signed-in employee's own year; an id: HR opening someone's (the service checks either way)
  const own = !employeeId || employeeId === "me";
  const [params, setParams] = useSearchParams();
  const fy = params.get("fy") ?? "";
  const [detail, setDetail] = useState<EmployeeTaxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [previewMonth, setPreviewMonth] = useState<string | null>(null);
  const [preview, setPreview] = useState<unknown | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    axios.get<EmployeeTaxDetail>(`${TAX_TRACKER_API}/${own ? "me" : employeeId}`, { params: fy ? { fy } : {} })
      .then((res) => {
        setDetail(res.data);
        setSelectedMonth(null);
      })
      .catch((error) => {
        setDetail(null);
        setLoadError(apiError(error, own ? "Your salary details could not be loaded" : "This employee's salary details could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [employeeId, own, fy]);

  const openPayslip = async (month: string) => {
    setPreviewMonth(month);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const res = await axios.get(`/v1/api/payroll/payslips/preview/${detail?.employee.employeeId}`, { params: { month } });
      setPreview(res.data);
    } catch (error) {
      ToasterService.error(apiError(error, "The payslip could not be loaded"));
      setPreviewMonth(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadPayslip = async (month: string) => {
    try {
      const response = await axios.get(`/v1/api/payroll/payslips/download`, { params: { employeeId: detail?.employee.employeeId, month }, responseType: "blob" });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip_${(detail?.employee.employeeName ?? "employee").replace(/\s/g, "_")}_${month}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      ToasterService.error(await blobError(error, "The payslip could not be downloaded"));
    }
  };

  const person = detail?.employee;
  const ordered = useMemo(() => [...(detail?.months ?? [])].sort((a, b) => a.month.localeCompare(b.month)), [detail]);
  // Each month is compared with the one before it this year (the first month has nothing to compare with)
  const previousOf = (index: number) => (index > 0 ? ordered[index - 1] : null);
  // The month shown in "A month's pay": the one clicked, else the latest paid month, else the first forecast
  const latestPaid = [...ordered].reverse().find((m) => m.status === "ACTUAL");
  const shown = ordered.find((m) => m.month === selectedMonth) ?? latestPaid ?? ordered[0];
  const colors = chartColors(isDarkTheme());
  const monthlyGross = detail?.salary ? Number(detail.salary.fixedPayTotal) / 12 : shown?.grossPay ?? 0;

  return (
    <>
      <PageMeta title={own ? t("My Salary") : t("Salary and tax")} description="Salary structure, monthly pay, payslips and income tax for the financial year" />
      <PageBreadcrumb
        pageTitle={own ? "My Salary" : person ? person.employeeName : "Salary and tax"}
        actions={
          <div className="flex items-center gap-2">
            {canApprove && !own && (
              <button type="button" className={TOOL_BUTTON} onClick={() => navigate(`/taxTracker${detail ? `?fy=${detail.financialYear}` : ""}`)}>
                <ArrowLeftIcon className="h-3.5 w-3.5" />{t("All employees")}
              </button>
            )}
            {person && (
              <button type="button" className={TOOL_BUTTON} onClick={() => setZipOpen(true)}>
                <FolderArrowDownIcon className="h-3.5 w-3.5" />{t("Payslips (ZIP)")}
              </button>
            )}
            {detail && (
              <ToolbarSelect aria-label={t("Financial year")} value={detail.financialYear}
                onChange={(e) => setParams({ fy: e.target.value })}>
                {Array.from(new Set([detail.financialYear, ...detail.financialYears])).map((year) => <option key={year} value={year}>FY {year}</option>)}
              </ToolbarSelect>
            )}
          </div>
        }
      />
      <div className={PAGE_BODY}>
        {loading && !detail ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>
        ) : !detail || !person ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{loadError ?? t("Salary details could not be loaded.")}</div>
        ) : (
          <>
            <div className={`${CARD} mb-4 flex items-center gap-3 p-3`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                {initials(person.employeeName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-slate-900 dark:text-white">{person.employeeName}</span>
                  <RegimePill regime={person.regime} />
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-gray-400">
                  {[person.employeeCode, person.designation, person.department].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric label={t("Yearly CTC")} value={money(detail.salary?.ctc ?? 0)} />
              <Metric label={t("Monthly gross")} value={money(monthlyGross)} note={t("full month")} />
              <Metric label={t("Monthly take-home")} value={money(shown?.takeHome ?? 0)} note={shown ? monthLabel(shown.month) : undefined} />
              <Metric label={t("Tax for the year")} value={money(person.projectedAnnualTax)} note={`FY ${detail.financialYear}`} />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {detail.salary && <CtcCard salary={detail.salary} />}
              {shown && <MonthPayCard line={shown} previous={previousOf(ordered.indexOf(shown))} onPreview={() => openPayslip(shown.month)} onDownload={() => downloadPayslip(shown.month)} />}
            </div>

            <div className={`${CARD} p-4`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className={`${CARD_TITLE} mr-1`}>{t("Income tax by month")}</div>
                {/* The year so far, beside the title: deducted (blue), forecast (orange), how much of the year is done */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-800 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.paid }} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{money(person.taxPaid)}</span> {t("deducted")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-800 ring-1 ring-inset ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.forecast }} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{money(person.taxForecast)}</span> {t("forecast")}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs text-cyan-800 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900"
                  title={`${paidShare(person.taxPaid, person.projectedAnnualTax)}% ${t("of the year's tax")} (${money(person.projectedAnnualTax)}) ${t("deducted")}`}>
                  <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-cyan-100 dark:bg-cyan-900" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-cyan-600" style={{ width: `${paidShare(person.taxPaid, person.projectedAnnualTax)}%` }} />
                  </span>
                  <span className="font-semibold tabular-nums">{paidShare(person.taxPaid, person.projectedAnnualTax)}%</span> {t("done")}
                </span>
              </div>
              {ordered.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">{t("Not employed during this financial year.")}</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {ordered.map((line, i) => (
                    <TaxTile key={line.month} line={line} previous={previousOf(i)} selected={shown?.month === line.month}
                      onSelect={() => setSelectedMonth(line.month)} />
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colors.paid }} />{t("Solid: paid")}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colors.forecast }} />{t("Dashed: forecast")}</span>
                <span className="inline-flex items-center gap-1"><DocumentArrowDownIcon className="h-3 w-3 text-cyan-600" aria-hidden="true" />{t("Payslip available: click the month")}</span>
                <span>{t("Forecast months assume a full month at today's salary; the tax left is spread evenly.")}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <PayslipPreviewModal
        isOpen={previewMonth != null}
        onClose={() => { setPreviewMonth(null); setPreview(null); }}
        payslipData={preview}
        month={previewMonth ?? ""}
        loading={previewLoading}
        onDownload={previewMonth ? () => downloadPayslip(previewMonth) : undefined}
      />
      {person && (
        <PayslipZipDialog isOpen={zipOpen} onClose={() => setZipOpen(false)} employeeId={person.employeeId} employeeName={person.employeeName} />
      )}
    </>
  );
};

export default TaxTrackerEmployeePage;
