import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { AlertTriangle, Download, FileText, Save } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { usePermissions } from "../../access/usePermissions";
import { ToasterService } from "../../Services/ToasterService";
import { apiError, apiFieldErrors } from "../../utils/apiError";
import { formatMoney, todayIso } from "../../company/format";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON, TOOL_BUTTON, TOOL_INPUT } from "./hrmsUi";

const API = "/v1/api/payroll/gulf";

interface Settings {
  uaeEmployerId: string | null;
  uaeAgentRoutingCode: string | null;
  uaeEmployerReference: string | null;
  saEstablishmentNumber: string | null;
  saGosiNumber: string | null;
}

interface RunFiles {
  batchReference: string;
  month: string;
  uaeEmployees: number;
  uaeTotal: number;
  wpsProblems: string[];
  saudiEmployees: number;
  saudiTotal: number;
  mudadProblems: string[];
}

interface ContributionRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  nationality: string | null;
  idNumber: string | null;
  insuranceNumber: string | null;
  scheme: string;
  currency: string;
  wage: number;
  parts: Record<string, number>;
  employee: number;
  employer: number;
  approximate: boolean;
}

interface ContributionReport {
  month: string;
  countryCode: string;
  rows: ContributionRow[];
  totals: Record<string, number>;
}

const EMPTY: Settings = { uaeEmployerId: "", uaeAgentRoutingCode: "", uaeEmployerReference: "", saEstablishmentNumber: "", saGosiNumber: "" };
const INPUT = "h-8 w-full rounded-lg border border-gray-300 px-2.5 text-xs dark:border-gray-700 dark:bg-[#222222] dark:text-white";

// Errors of a file download arrive as a Blob; read the server's message out of it
const downloadError = async (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      return body.message || body.error || fallback;
    } catch {
      return fallback;
    }
  }
  return apiError(error, fallback);
};

const save = (data: BlobPart, name: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** UAE WPS salary files and Saudi Mudad files per payroll run, the month's GOSI / GPSSA contributions, and the company's registrations. */
export default function GulfPayFilesPage() {
  const { canUpdate, canExport } = usePermissions();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<RunFiles[]>([]);
  const [country, setCountry] = useState<"SA" | "AE">("SA");
  const [report, setReport] = useState<ContributionReport | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    axios.get<Settings>(`${API}/settings`).then((r) => setSettings({ ...EMPTY, ...r.data }), () => undefined);
  }, []);

  const loadRuns = useCallback(() => {
    axios.get<RunFiles[]>(`${API}/runs`, { params: { month } })
      .then((r) => setRuns(r.data), (e) => ToasterService.error(apiError(e, "The payroll runs could not be loaded")));
  }, [month]);
  useEffect(loadRuns, [loadRuns]);

  useEffect(() => {
    axios.get<ContributionReport>(`${API}/contributions`, { params: { month, country } })
      .then((r) => setReport(r.data), (e) => ToasterService.error(apiError(e, "The contributions could not be loaded")));
  }, [month, country]);

  const saveSettings = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { data } = await axios.put<Settings>(`${API}/settings`, settings);
      setSettings({ ...EMPTY, ...data });
      ToasterService.success("Registrations saved");
      loadRuns();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      ToasterService.error(apiError(error, "The registrations were not saved"));
    } finally {
      setSaving(false);
    }
  };

  const download = async (kind: "wps" | "mudad", run: RunFiles) => {
    setBusy(`${kind}-${run.batchReference}`);
    try {
      const response = await axios.get(`${API}/${kind}/${run.batchReference}`, { responseType: "blob" });
      const name = /filename="?([^";]+)"?/.exec(String(response.headers["content-disposition"] ?? ""))?.[1]
        ?? (kind === "wps" ? `${run.batchReference}.SIF` : `mudad_${run.batchReference}.xlsx`);
      save(response.data, name, kind === "wps" ? "text/plain" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (error) {
      ToasterService.error(await downloadError(error, "The file could not be made"));
    } finally {
      setBusy("");
    }
  };

  // Employee shares, then the employer's
  const partNames = Array.from(new Set((report?.rows ?? []).flatMap((row) => Object.keys(row.parts))))
    .sort((a, b) => Number(a.includes("(employer)")) - Number(b.includes("(employer)")) || a.localeCompare(b));
  const exportContributions = () => {
    if (!report?.rows.length) return ToasterService.warning("Nothing to export");
    const sheet = XLSX.utils.json_to_sheet(report.rows.map((row) => ({
      "Employee code": row.employeeCode,
      Employee: row.employeeName,
      Nationality: row.nationality ?? "",
      [country === "SA" ? "ID / Iqama" : "Emirates ID"]: row.idNumber ?? "",
      ...(country === "SA" ? { "GOSI number": row.insuranceNumber ?? "" } : {}),
      Scheme: row.scheme,
      "Contribution wage": Number(row.wage),
      ...Object.fromEntries(partNames.map((part) => [part, Number(row.parts[part] ?? 0)])),
      "Employee total": Number(row.employee),
      "Employer total": Number(row.employer),
      Currency: row.currency,
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, country === "SA" ? "GOSI" : "GPSSA");
    XLSX.writeFile(book, `${country === "SA" ? "GOSI" : "GPSSA"}_contributions_${month}.xlsx`);
  };

  const field = (key: keyof Settings, label: string, hint?: string) => (
    <div>
      <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t(label)}</label>
      <input value={settings[key] ?? ""} disabled={!canUpdate} dir="ltr" aria-label={t(label)}
        onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
        className={`${INPUT} ${errors[key] ? "border-red-500" : ""}`} />
      {errors[key] ? <p className="mt-0.5 text-[10px] text-red-600">{t(errors[key])}</p>
        : hint && <p className="mt-0.5 text-[10px] text-gray-500">{t(hint)}</p>}
    </div>
  );

  const problems = (list: string[]) => list.length > 0 && (
    <ul className="mt-1 space-y-0.5 text-[10px] text-amber-700">
      {list.map((p) => <li key={p} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />{p}</li>)}
    </ul>
  );

  return (
    <>
      <PageMeta title={t("Gulf Pay Files")} description="UAE WPS salary files, Saudi Mudad files and GOSI / GPSSA contributions" />
      <PageBreadcrumb
        pageTitle="Gulf Pay Files"
        actions={<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={TOOL_INPUT} aria-label={t("Payroll month")} />}
      />
      <div className={`${PAGE_BODY} space-y-4`}>
        <section className={`${CARD} p-4`}>
          <h3 className={CARD_TITLE}>{t("Company registrations")}</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {field("uaeEmployerId", "UAE: MOHRE establishment ID", "13 digits; names the WPS file")}
            {field("uaeAgentRoutingCode", "UAE: WPS agent routing code", "The bank or exchange house that pays the salaries, 9 digits")}
            {field("uaeEmployerReference", "UAE: reference on the file (optional)")}
            {field("saEstablishmentNumber", "KSA: labour office establishment number", "e.g. 1-1234567, for Mudad")}
            {field("saGosiNumber", "KSA: GOSI establishment number")}
          </div>
          {canUpdate && (
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={saveSettings} disabled={saving} className={PRIMARY_BUTTON}>
                <Save className="h-4 w-4" />{t(saving ? "Saving..." : "Save")}
              </button>
            </div>
          )}
        </section>

        <section className={`${CARD} p-4`}>
          <h3 className={CARD_TITLE}>{t("Salary files by payroll run")}</h3>
          {runs.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">{t("No payroll has been run for this month yet.")}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {runs.map((run) => (
                <div key={run.batchReference} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-[180px_1fr_1fr] dark:border-[#2a2a2a]">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white" dir="ltr">{run.batchReference}</div>
                  <div className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t("UAE (WPS)")}: {run.uaeEmployees} · <span dir="ltr">{formatMoney(run.uaeTotal, { currency: "AED" })}</span></span>
                      {run.uaeEmployees > 0 && canExport && (
                        <button type="button" className={TOOL_BUTTON} disabled={run.wpsProblems.length > 0 || busy !== ""}
                          onClick={() => download("wps", run)}>
                          <FileText className="h-3.5 w-3.5" />{t("WPS file (SIF)")}
                        </button>
                      )}
                    </div>
                    {problems(run.wpsProblems)}
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t("Saudi Arabia (Mudad)")}: {run.saudiEmployees} · <span dir="ltr">{formatMoney(run.saudiTotal, { currency: "SAR" })}</span></span>
                      {run.saudiEmployees > 0 && canExport && (
                        <button type="button" className={TOOL_BUTTON} disabled={run.mudadProblems.length > 0 || busy !== ""}
                          onClick={() => download("mudad", run)}>
                          <Download className="h-3.5 w-3.5" />{t("Mudad file")}
                        </button>
                      )}
                    </div>
                    {problems(run.mudadProblems)}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-500">
                {t("The Mudad workbook follows the usual payroll upload columns; check them against your Mudad template.")}
              </p>
            </div>
          )}
        </section>

        <section className={`${CARD} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className={CARD_TITLE}>{t("Pension and social insurance")}</h3>
            <div className="flex items-center gap-2">
              {(["SA", "AE"] as const).map((code) => (
                <button key={code} type="button" onClick={() => setCountry(code)}
                  className={country === code ? PRIMARY_BUTTON.replace("px-4 py-2 text-sm", "px-3 py-1 text-xs") : SECONDARY_BUTTON.replace("px-4 py-2 text-sm", "px-3 py-1 text-xs")}>
                  {t(code === "SA" ? "Saudi Arabia (GOSI)" : "UAE (GPSSA / ADPF)")}
                </button>
              ))}
              {canExport && (
                <button type="button" onClick={exportContributions} className={TOOL_BUTTON}>
                  <Download className="h-3.5 w-3.5" />{t("Export Excel")}
                </button>
              )}
            </div>
          </div>
          {!report?.rows.length ? (
            <p className="mt-2 text-xs text-gray-500">{t("No contributions for this month.")}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-start text-[10px] uppercase tracking-wide text-gray-500 dark:border-[#2a2a2a]">
                    <th className="py-2 text-start">{t("Employee")}</th>
                    <th className="py-2 text-start">{t(country === "SA" ? "ID / Iqama" : "Emirates ID")}</th>
                    <th className="py-2 text-end">{t("Contribution wage")}</th>
                    {partNames.map((part) => <th key={part} className="py-2 text-end">{t(part)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.employeeId} className="border-b border-gray-100 dark:border-[#2a2a2a]">
                      <td className="py-2">
                        <div className="font-semibold text-gray-900 dark:text-white">{row.employeeName}</div>
                        <div className="text-[10px] text-gray-500">{row.employeeCode} · {row.scheme}{row.approximate ? ` · ${t("Approximate")}` : ""}</div>
                      </td>
                      <td className="py-2" dir="ltr">{row.idNumber ?? "—"}</td>
                      <td className="py-2 text-end" dir="ltr">{formatMoney(row.wage, { currency: row.currency })}</td>
                      {partNames.map((part) => (
                        <td key={part} className="py-2 text-end" dir="ltr">{row.parts[part] != null ? formatMoney(row.parts[part], { currency: row.currency }) : "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2" colSpan={3}>{t("Total")}</td>
                    {partNames.map((part) => (
                      <td key={part} className="py-2 text-end" dir="ltr">
                        {formatMoney(report.totals[part] ?? 0, { currency: report.rows[0]?.currency })}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
