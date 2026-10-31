import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { ImportResult, ImportRun, ImportType, importApi } from "../../dataImport/importApi";
import { formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON, TOOL_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Go-live data from Excel: choose what to import, download its template, upload the filled file. Every row is
 * checked first and nothing is saved until the whole file is right; then one click imports all of it.
 */
export default function DataImportPage() {
  const [types, setTypes] = useState<ImportType[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"check" | "run" | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [history, setHistory] = useState<ImportRun[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(() => {
    importApi.history().then(setHistory).catch(() => undefined);
  }, []);

  useEffect(() => {
    importApi.types()
      .then((list) => {
        setTypes(list);
        setSelected((s) => s ?? list.find((x) => x.allowed)?.type ?? null);
      })
      .catch((err) => {
        setTypes([]);
        ToasterService.error("Imports could not be loaded", errorText(err, "Is the common service running?"));
      });
    loadHistory();
  }, [loadHistory]);

  const type = types?.find((x) => x.type === selected) ?? null;

  const choose = (next: ImportType) => {
    if (!next.allowed) return;
    setSelected(next.type);
    setFile(null);
    setResult(null);
    setShowColumns(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const downloadTemplate = async () => {
    if (!type) return;
    try {
      saveBlob(await importApi.template(type), `${type.title.replace(/\s+/g, "_")}_import_template.xlsx`);
    } catch (err) {
      ToasterService.error("The template could not be downloaded", errorText(err, "Please try again."));
    }
  };

  const check = async (picked: File) => {
    if (!type) return;
    setFile(picked);
    setResult(null);
    setBusy("check");
    try {
      setResult(await importApi.check(type, picked));
    } catch (err) {
      ToasterService.error("The file could not be checked", errorText(err, "Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!type || !file) return;
    setBusy("run");
    try {
      const done = await importApi.run(type, file);
      setResult(done);
      if (done.imported) {
        ToasterService.success(`${t(type.title)}: ${t("Imported")} ${done.rows} ${t(done.rows === 1 ? "row" : "rows")}.`);
        loadHistory();
      } else {
        ToasterService.error("Nothing was imported: the file has problems.");
      }
    } catch (err) {
      ToasterService.error("The import failed; nothing was saved", errorText(err, "Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const startOver = () => {
    setFile(null);
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const downloadProblems = () => {
    if (!result || !type) return;
    const ws = XLSX.utils.json_to_sheet(result.problems.map((p) => ({
      [t("Row")]: p.row === 0 ? t("File") : p.row, [t("Column")]: p.column ?? "", [t("Problem")]: p.message,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Problems");
    XLSX.writeFile(wb, `${type.title.replace(/\s+/g, "_")}_import_problems.xlsx`);
  };

  // Preview only the columns that have something in them
  const previewColumns = result
    ? Object.keys(result.preview[0] ?? {}).filter((c) => result.preview.some((r) => r[c] != null && r[c] !== ""))
    : [];

  return (
    <>
      <PageMeta title={t("Data Import")} description="Bring your existing records in from Excel" />
      <PageBreadcrumb
        pageTitle="Data Import"
        actions={(
          <button type="button" className={TOOL_BUTTON} onClick={loadHistory}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("Refresh")}
          </button>
        )}
      />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className={`${CARD} p-4 text-sm text-slate-600 dark:text-gray-300`}>
          {t("Bring your existing records in from Excel: download a template, fill it in and upload it. Every row is checked first, and nothing is saved until the whole file is right.")}
        </div>

        {types === null ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-400`}>{t("Loading...")}</div>
        ) : types.length === 0 ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-400`}>{t("No imports are available right now.")}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {types.map((x) => {
              const active = x.type === selected;
              return (
                <button key={x.type} type="button" onClick={() => choose(x)} disabled={!x.allowed} aria-pressed={active}
                  className={`${CARD} p-4 text-start transition ${active ? "ring-2 ring-cyan-500" : ""} ${x.allowed ? "hover:border-cyan-300" : "cursor-not-allowed opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-cyan-600" />
                    <span className={CARD_TITLE}>{t(x.title)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">{t(x.description)}</p>
                  {!x.allowed && (
                    <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{t("Needs the permission")} {x.permission}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {type && (
          <div className={`${CARD} space-y-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={CARD_TITLE}>{t("Import")} {t(type.title).toLowerCase()}</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON} onClick={downloadTemplate}>
                  <Download className="h-4 w-4" /> {t("Download template")}
                </button>
                <label className={`${PRIMARY_BUTTON} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                  <Upload className="h-4 w-4" /> {t(file ? "Upload another file" : "Upload filled file")}
                  <input ref={fileInput} type="file" className="sr-only" accept=".xlsx,.xls,.csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) check(f); }} />
                </label>
              </div>
            </div>

            <div>
              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300"
                aria-expanded={showColumns} onClick={() => setShowColumns((s) => !s)}>
                {showColumns ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {t("Columns in this template")} ({type.columns.length})
              </button>
              {showColumns && (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]">
                      <tr>
                        <th className={TH}>{t("Column")}</th>
                        <th className={TH}>{t("Required")}</th>
                        <th className={TH}>{t("Example")}</th>
                        <th className={TH}>{t("Notes")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {type.columns.map((c) => (
                        <tr key={c.header}>
                          <td className={`${TD} whitespace-nowrap font-medium`}>{c.header}</td>
                          <td className={TD}>{c.required ? t("Yes") : ""}</td>
                          <td className={`${TD} whitespace-nowrap`}>{c.example ?? ""}</td>
                          <td className={`${TD} min-w-[280px] text-xs`}>
                            {c.note ?? ""}
                            {c.choices.length > 0 && <div className="mt-1 text-slate-500">{t("Allowed")}: {c.choices.join(", ")}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {busy === "check" && <p className="text-sm text-slate-500">{t("Checking")} {file?.name}...</p>}

            {result && !result.imported && result.problemCount > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <strong>{result.problemCount} {t(result.problemCount === 1 ? "problem" : "problems")}</strong>{" "}
                      {t("in")} {result.fileName}. {t("Nothing was saved. Fix them in the file and upload it again.")}
                      {result.problemCount > result.problems.length && (
                        <> {t("The first")} {result.problems.length} {t("are listed.")}</>
                      )}
                    </span>
                  </div>
                  <button type="button" className={TOOL_BUTTON} onClick={downloadProblems}>
                    <Download className="h-3.5 w-3.5" /> {t("Download list")}
                  </button>
                </div>
                <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-100 dark:border-gray-800">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-[#222222]">
                      <tr>
                        <th className={`${TH} w-20`}>{t("Row")}</th>
                        <th className={`${TH} w-48`}>{t("Column")}</th>
                        <th className={TH}>{t("Problem")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {result.problems.map((p, i) => (
                        <tr key={i}>
                          <td className={`${TD} whitespace-nowrap`}>{p.row === 0 ? t("File") : p.row}</td>
                          <td className={`${TD} whitespace-nowrap font-medium`}>{p.column ?? "—"}</td>
                          <td className={TD}>{p.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result && !result.imported && result.problemCount === 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("All")} {result.rows} {t(result.rows === 1 ? "row is correct" : "rows are correct")} ({result.fileName}).
                  </span>
                  <div className="flex gap-2">
                    <button type="button" className={SECONDARY_BUTTON} onClick={startOver} disabled={busy !== null}>{t("Cancel")}</button>
                    <button type="button" className={PRIMARY_BUTTON} onClick={runImport} disabled={busy !== null}>
                      {busy === "run" ? t("Importing...") : `${t("Import")} ${result.rows} ${t(result.rows === 1 ? "row" : "rows")}`}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {t("First rows, as they will be saved")}{result.rows > result.preview.length && <> ({result.preview.length} {t("of")} {result.rows})</>}:
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]">
                      <tr>{previewColumns.map((c) => <th key={c} className={`${TH} whitespace-nowrap`}>{c}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {result.preview.map((r, i) => (
                        <tr key={i}>{previewColumns.map((c) => <td key={c} className={`${TD} whitespace-nowrap`}>{r[c] ?? ""}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result?.imported && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t(type.title)}: {t("Imported")} {result.rows} {t(result.rows === 1 ? "row" : "rows")} {t("from")} {result.fileName}.
                </span>
                <button type="button" className={SECONDARY_BUTTON} onClick={startOver}>{t("Import another file")}</button>
              </div>
            )}
          </div>
        )}

        <div className={`${CARD} overflow-hidden`}>
          <div className="border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <h2 className={CARD_TITLE}>{t("Past imports")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]">
                <tr>
                  <th className={TH}>{t("Imported")}</th>
                  <th className={TH}>{t("What")}</th>
                  <th className={TH}>{t("File")}</th>
                  <th className={TH}>{t("Rows")}</th>
                  <th className={TH}>{t("By")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("Nothing has been imported yet.")}</td></tr>
                ) : history.map((h) => (
                  <tr key={`${h.type}-${h.id}`}>
                    <td className={`${TD} whitespace-nowrap`}>{formatDateTime(h.importedAt)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{t(h.title)}</td>
                    <td className={TD}>{h.fileName ?? "—"}</td>
                    <td className={TD}>{h.rows}</td>
                    <td className={`${TD} whitespace-nowrap`}>{h.importedBy ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
