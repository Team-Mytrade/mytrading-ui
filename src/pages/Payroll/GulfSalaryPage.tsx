import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, DocumentArrowDownIcon, EyeIcon, FolderArrowDownIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PayslipPreviewModal from "../../components/Payroll/PayslipPreviewModal";
import PayslipZipDialog from "../../components/Payroll/PayslipZipDialog";
import ToolbarSelect from "../../components/common/ToolbarSelect";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE, PAGE_BODY, TOOL_BUTTON } from "./hrmsUi";
import { ICON_BUTTON, Metric, Row, TakeHomeChip, blobError } from "./TaxTrackerEmployeePage";
import { chartColors, initials, isDarkTheme, money, monthLabel } from "./taxTracker";
import { GULF_PAY_API, GulfEmployeeDetail, GulfMonthLine, GulfPayPackage } from "./gulfPay";

const SHADES = ["#2a78d6", "#5e9be3", "#93bdee", "#c3dbf6", "#dbe9f9"];
const EMPLOYER_SHADE = "#9ca3af";

/** The yearly package: fixed pay, plus what the employer pays besides (pension share, gratuity). */
const PackageCard: React.FC<{ pay: GulfPayPackage }> = ({ pay }) => {
  const parts = [
    ...pay.fixedPay.map((l, i) => ({ name: l.name, yearly: Number(l.yearly), color: SHADES[Math.min(i, SHADES.length - 1)] })),
    ...(pay.employerContributionYearly > 0 ? [{ name: t("Employer pension"), yearly: Number(pay.employerContributionYearly), color: EMPLOYER_SHADE }] : []),
    ...(pay.gratuityYearly > 0 ? [{ name: t("Gratuity"), yearly: Number(pay.gratuityYearly), color: "#cbd5e1" }] : []),
  ];
  const whole = parts.reduce((a, p) => a + p.yearly, 0) || 1;
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-2 flex items-baseline justify-between">
        <div className={CARD_TITLE}>{t("Annual package")}</div>
        <span className="text-xs text-slate-500 dark:text-gray-400">{t("yearly")}</span>
      </div>
      <div className="mb-3 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img"
        aria-label={parts.map((p) => `${p.name} ${money(p.yearly)}`).join(", ")}>
        {parts.map((p) => <div key={p.name} style={{ width: `${(p.yearly / whole) * 100}%`, background: p.color }} title={`${p.name}: ${money(p.yearly)}`} />)}
      </div>
      {pay.fixedPay.map((l, i) => (
        <Row key={l.name} label={<><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: SHADES[Math.min(i, SHADES.length - 1)] }} />{l.name}</>}
          value={money(l.yearly)} />
      ))}
      <Row label={t("Total pay")} value={money(pay.fixedPayTotal)} strong topLine />
      {pay.employerContributionYearly > 0 && (
        <Row muted label={`${t("Employer pension / social insurance")}${pay.scheme ? ` (${pay.scheme})` : ""}`} value={`+ ${money(pay.employerContributionYearly)}`} />
      )}
      {pay.gratuityYearly > 0 && <Row muted label={t("End-of-service gratuity (yearly provision)")} value={`+ ${money(pay.gratuityYearly)}`} />}
      <Row label={t("Cost to company")} value={money(pay.costToCompany)} strong topLine />
      <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
        {pay.scheme
          ? `${t("Pension")}: ${pay.scheme}${pay.gccNational ? ` (${t("GCC national")})` : ""}.`
          : t("No pension or social insurance deduction: it applies to nationals (and GCC nationals) on Gulf payroll.")}
      </p>
    </div>
  );
};

/** One month's pay: gross, the pension share and other deductions, take-home, and what the employer adds. */
const MonthPayCard: React.FC<{ line: GulfMonthLine; previous: GulfMonthLine | null; onPreview: () => void; onDownload: () => void }> = ({ line, previous, onPreview, onDownload }) => {
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
      {line.employeeContribution > 0 && <Row muted label={t("Pension / social insurance (you)")} value={`− ${money(line.employeeContribution)}`} />}
      {line.otherDeductions > 0 && <Row muted label={t("Other deductions")} value={`− ${money(line.otherDeductions)}`} />}
      <Row label={<span className="inline-flex items-center gap-2">{t("Take-home")}<TakeHomeChip takeHome={line.takeHome} previous={previous} size="md" /></span>}
        value={money(line.takeHome)} strong topLine />
      {(line.employerContribution > 0 || line.gratuityAccrual > 0) && (
        <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
          {t("Your employer adds")} {[line.employerContribution > 0 ? `${t("pension")} ${money(line.employerContribution)}` : "",
            line.gratuityAccrual > 0 ? `${t("gratuity")} ${money(line.gratuityAccrual)}` : ""].filter(Boolean).join(" · ")} {t("(not deducted from your pay)")}
        </p>
      )}
      {!forecast && !line.payslipAvailable && <p className="mt-2 text-xs text-slate-400">{t("No payslip for this month yet")}</p>}
    </div>
  );
};

/** A month as a small tile: the take-home and its change, paid (solid) or forecast (dashed). */
const PayTile: React.FC<{ line: GulfMonthLine; previous: GulfMonthLine | null; selected: boolean; onSelect: () => void }> = ({ line, previous, selected, onSelect }) => (
  <button type="button" onClick={onSelect} aria-pressed={selected}
    className={`flex flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${line.status === "FORECAST" ? "border-dashed" : ""} ${selected ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30" : "border-slate-200 bg-white hover:border-cyan-300 dark:border-gray-700 dark:bg-[#191919]"}`}>
    <span className="flex w-full items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
      {monthLabel(line.month, true)}
      {line.payslipAvailable && <DocumentArrowDownIcon className="h-3 w-3 text-cyan-600" aria-label={t("Payslip available")} />}
    </span>
    <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{money(line.takeHome)}</span>
    {previous ? <TakeHomeChip takeHome={line.takeHome} previous={previous} /> : <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600 dark:bg-[#222222] dark:text-gray-300">{t("First")}</span>}
    {line.employeeContribution > 0 && (
      <span className="w-full border-t border-slate-100 pt-1 text-[10.5px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
        {t("Pension")} {money(line.employeeContribution)}
      </span>
    )}
  </button>
);

/**
 * My Salary on Gulf payroll (no income tax): the annual package, a month's pay with its payslip, the pension /
 * social insurance shares and the end-of-service gratuity, and the take-home month by month over the calendar year.
 */
const GulfSalaryPage: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { canApprove } = usePermissions();
  const own = !employeeId || employeeId === "me";
  const [params, setParams] = useSearchParams();
  const year = params.get("year") ?? "";
  const [detail, setDetail] = useState<GulfEmployeeDetail | null>(null);
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
    axios.get<GulfEmployeeDetail>(`${GULF_PAY_API}/${own ? "me" : employeeId}`, { params: year ? { year } : {} })
      .then((res) => { setDetail(res.data); setSelectedMonth(null); })
      .catch((error) => {
        setDetail(null);
        setLoadError(apiError(error, own ? "Your salary details could not be loaded" : "This employee's salary details could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [employeeId, own, year]);

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
  const previousOf = (index: number) => (index > 0 ? ordered[index - 1] : null);
  const latestPaid = [...ordered].reverse().find((m) => m.status === "ACTUAL");
  const shown = ordered.find((m) => m.month === selectedMonth) ?? latestPaid ?? ordered[0];
  const colors = chartColors(isDarkTheme());

  return (
    <>
      <PageMeta title={own ? t("My Salary") : t("Salary")} description="Annual package, monthly pay, payslips, pension and end-of-service gratuity" />
      <PageBreadcrumb
        pageTitle={own ? "My Salary" : person ? person.employeeName : "Salary"}
        actions={
          <div className="flex items-center gap-2">
            {canApprove && !own && (
              <button type="button" className={TOOL_BUTTON} onClick={() => navigate(`/taxTracker${detail ? `?year=${detail.year}` : ""}`)}>
                <ArrowLeftIcon className="h-3.5 w-3.5" />{t("All employees")}
              </button>
            )}
            {person && (
              <button type="button" className={TOOL_BUTTON} onClick={() => setZipOpen(true)}>
                <FolderArrowDownIcon className="h-3.5 w-3.5" />{t("Payslips (ZIP)")}
              </button>
            )}
            {detail && (
              <ToolbarSelect aria-label={t("Year")} value={String(detail.year)} onChange={(e) => setParams({ year: e.target.value })}>
                {Array.from(new Set([detail.year, ...detail.years])).map((y) => <option key={y} value={y}>{y}</option>)}
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
                  {person.scheme && <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-gray-700 dark:text-gray-300">{person.scheme}</span>}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-gray-400">
                  {[person.employeeCode, person.designation, person.department].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric label={t("Annual package")} value={money(detail.pay.fixedPayTotal)} note={`${t("cost to company")} ${money(detail.pay.costToCompany)}`} />
              <Metric label={t("Monthly gross")} value={money(Number(detail.pay.fixedPayTotal) / 12)} note={t("full month")} />
              <Metric label={t("Monthly take-home")} value={money(shown?.takeHome ?? 0)} note={shown ? monthLabel(shown.month) : undefined} />
              <Metric label={t("Gratuity to date")} value={money(detail.pay.gratuityToDate)} note={t("end of service, if leaving today")} />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PackageCard pay={detail.pay} />
              {shown && <MonthPayCard line={shown} previous={previousOf(ordered.indexOf(shown))} onPreview={() => openPayslip(shown.month)} onDownload={() => downloadPayslip(shown.month)} />}
            </div>

            <div className={`${CARD} p-4`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className={`${CARD_TITLE} mr-1`}>{t("Take-home by month")}</div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-800 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.paid }} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{money(person.netPaid)}</span> {t("paid")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-800 ring-1 ring-inset ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.forecast }} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{money(person.netForecast)}</span> {t("forecast")}
                </span>
                {Number(person.employeeContributionPaid) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-[#222222] dark:text-gray-300 dark:ring-[#303030]">
                    {t("Pension paid")} <span className="font-semibold tabular-nums">{money(person.employeeContributionPaid)}</span>
                  </span>
                )}
              </div>
              {ordered.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">{t("Not employed during this year.")}</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {ordered.map((line, i) => (
                    <PayTile key={line.month} line={line} previous={previousOf(i)} selected={shown?.month === line.month} onSelect={() => setSelectedMonth(line.month)} />
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colors.paid }} />{t("Solid: paid")}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colors.forecast }} />{t("Dashed: forecast")}</span>
                <span className="inline-flex items-center gap-1"><DocumentArrowDownIcon className="h-3 w-3 text-cyan-600" aria-hidden="true" />{t("Payslip available: click the month")}</span>
                <span>{t("No income tax on Gulf payroll. Forecast months assume a full month at today's salary.")}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <PayslipPreviewModal isOpen={previewMonth != null} onClose={() => { setPreviewMonth(null); setPreview(null); }}
        payslipData={preview} month={previewMonth ?? ""} loading={previewLoading}
        onDownload={previewMonth ? () => downloadPayslip(previewMonth) : undefined} />
      {person && <PayslipZipDialog isOpen={zipOpen} onClose={() => setZipOpen(false)} employeeId={person.employeeId} employeeName={person.employeeName} />}
    </>
  );
};

export default GulfSalaryPage;
