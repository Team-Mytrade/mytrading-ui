import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Download, Lock, RefreshCw, Rocket, Upload } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON, TOOL_BUTTON, TOOL_INPUT } from "../Payroll/hrmsUi";
import {
  GoLiveResult, MigrationBatch, MigrationProject, MigrationRow, MigrationStage, migrationApi,
} from "../../migration/migrationApi";
import { t } from "../../i18n/i18n";

const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";
const SOURCES = ["Manual records", "Keka", "greytHR", "Zoho People", "Darwinbox", "Bayzat", "Other"];

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const STATUS_STYLE: Record<string, string> = {
  COMMITTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  STAGED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  NOT_STARTED: "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300",
  DISCARDED: "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400",
  UNDONE: "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400",
  REFUSED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};
const STATUS_LABEL: Record<string, string> = {
  COMMITTED: "Committed", STAGED: "Staged", NOT_STARTED: "Not started", DISCARDED: "Discarded", UNDONE: "Undone", REFUSED: "Refused",
};

function Chip({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.NOT_STARTED}`}>
      {t(STATUS_LABEL[status] ?? status)}
    </span>
  );
}

const totalsText = (totals: Record<string, number>) =>
  Object.entries(totals).map(([k, v]) => `${t(k)}: ${Number(v).toLocaleString()}`).join(" · ");

/**
 * Go-live: move a company's HR, payroll and leave data into MyTrade stage by stage. Files are staged and checked
 * (nothing reaches live records), problems are fixed in place, each stage is committed in order, and go-live gives
 * the migrated employees their logins.
 */
export default function GoLivePage() {
  const [project, setProject] = useState<MigrationProject | null>(null);
  const [batches, setBatches] = useState<MigrationBatch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goLiveDate, setGoLiveDate] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<MigrationBatch[] | null>(null);
  const [openBatch, setOpenBatch] = useState<MigrationBatch | null>(null);
  const [rows, setRows] = useState<MigrationRow[]>([]);
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  const [goLive, setGoLive] = useState<GoLiveResult | null>(null);
  const workbookInput = useRef<HTMLInputElement>(null);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([migrationApi.project(), migrationApi.batches()]);
      setProject(p);
      setBatches(b);
      setGoLiveDate(p.goLiveDate ?? "");
      setSource(p.sourceSystem ?? "");
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, "Is the common service running?"));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const live = project?.status === "LIVE";

  const run = async <T,>(key: string, work: () => Promise<T>, failure: string): Promise<T | undefined> => {
    setBusy(key);
    try {
      return await work();
    } catch (err) {
      ToasterService.error(failure, errorText(err, "Please try again."));
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const saveProject = async () => {
    const saved = await run("project", () => migrationApi.saveProject(goLiveDate || null, source || null), "The go-live details could not be saved");
    if (saved) {
      setProject(saved);
      ToasterService.success("Go-live details saved.");
    }
  };

  const openRows = async (batch: MigrationBatch) => {
    if (batch.id == null) return;
    setOpenBatch(batch);
    setEdits({});
    const list = await run(`rows-${batch.id}`, () => migrationApi.rows(batch.id as number, batch.status === "STAGED"), "The rows could not be loaded");
    setRows(list ?? []);
  };

  const afterChange = async (changed: MigrationBatch | undefined, message?: string) => {
    if (!changed) return;
    if (message) ToasterService.success(message);
    // The upload summary follows the batch (a fixed row clears its "problems")
    setLastUpload((list) => list?.map((b) => (b.id != null && b.id === changed.id ? changed : b)) ?? null);
    await load();
    if (openBatch && changed.id === openBatch.id) {
      setOpenBatch(changed);
      if (changed.status === "STAGED") {
        setRows(await migrationApi.rows(changed.id as number, true).catch(() => []));
      } else {
        setOpenBatch(null);
      }
    }
  };

  const uploadOne = async (type: string, picked: File) => {
    const staged = await run(`upload-${type}`, () => migrationApi.upload(type, picked), "The file could not be staged");
    if (staged) {
      setLastUpload([staged]);
      await load();
      if (staged.id != null) openRows(staged);
    }
  };

  const uploadWorkbook = async (picked: File) => {
    const staged = await run("workbook-up", () => migrationApi.uploadWorkbook(picked), "The workbook could not be staged");
    if (workbookInput.current) workbookInput.current.value = "";
    if (staged) {
      setLastUpload(staged);
      await load();
    }
  };

  const commit = async (batch: MigrationBatch) => {
    const done = await run(`commit-${batch.id}`, () => migrationApi.commit(batch.id as number), "The batch could not be committed");
    if (done?.status === "COMMITTED") {
      afterChange(done, `${t(done.title)}: ${done.newCount} ${t("new")}, ${done.updatedCount} ${t("updated")}.`);
    } else if (done) {
      ToasterService.error("Nothing was saved: the batch has problems.");
      afterChange(done);
    }
  };

  const undo = async (batch: MigrationBatch) => {
    const ok = await confirm({
      title: t("Undo this batch?"),
      message: t("The records this batch created are removed; records it updated keep their new values."),
      confirmLabel: t("Undo"),
      variant: "danger",
    });
    if (ok) afterChange(await run(`undo-${batch.id}`, () => migrationApi.undo(batch.id as number), "The batch could not be undone"), t("Undone."));
  };

  const saveRow = async (row: MigrationRow) => {
    if (!openBatch?.id) return;
    const changed = edits[row.id];
    if (!changed || Object.keys(changed).length === 0) return;
    const checked = await run(`row-${row.id}`, () => migrationApi.fixRow(openBatch.id as number, row.id, changed), "The row could not be saved");
    if (checked) {
      setEdits((e) => ({ ...e, [row.id]: {} }));
      afterChange(checked, checked.problemCount === 0 ? t("Every row is correct now.") : undefined);
    }
  };

  const takeLive = async () => {
    const ok = await confirm({
      title: t("Go live on MyTrade?"),
      message: t("Every migrated employee gets a login and an email to set their password. After this nothing more is committed or undone here."),
      confirmLabel: t("Go live"),
      variant: "warning",
    });
    if (!ok) return;
    const result = await run("go-live", () => migrationApi.goLive(), "Go-live failed");
    if (result) {
      setGoLive(result);
      if (result.status === "LIVE") ToasterService.success(`${t("You are live.")} ${result.loginsCreated} ${t("login(s) created.")}`);
      else ToasterService.error(`${result.failures.length} ${t("login(s) could not be made; fix them and go live again.")}`);
      load();
    }
  };

  if (loadError) {
    return (
      <>
        <PageMeta title={t("Go-live")} description="Move your HR, payroll and leave data into MyTrade" />
        <PageBreadcrumb pageTitle="Go-live" />
        <div className={`${CARD} p-8 text-center text-sm text-red-600`}>{t("The go-live project could not be loaded.")} {loadError}</div>
      </>
    );
  }
  if (!project) {
    return (
      <>
        <PageMeta title={t("Go-live")} description="Move your HR, payroll and leave data into MyTrade" />
        <PageBreadcrumb pageTitle="Go-live" />
        <div className={`${CARD} p-8 text-center text-sm text-slate-400`}>{t("Loading...")}</div>
      </>
    );
  }

  const columnsOf = (batch: MigrationBatch) =>
    project.stages.flatMap((s) => s.types).find((x) => x.type === batch.type)?.columns.map((c) => c.header)
      ?? Object.keys(rows[0]?.values ?? {});

  return (
    <>
      <PageMeta title={t("Go-live")} description="Move your HR, payroll and leave data into MyTrade" />
      <PageBreadcrumb
        pageTitle="Go-live"
        actions={(
          <button type="button" className={TOOL_BUTTON} onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("Refresh")}
          </button>
        )}
      />
      <div className={`${PAGE_BODY} space-y-4`}>
        {/* The project */}
        <div className={`${CARD} space-y-3 p-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl text-sm text-slate-600 dark:text-gray-300">
              {t("Bring your HR, payroll and leave data in from your old system, stage by stage. Each file is checked first and nothing reaches live records until you commit it; mistakes are fixed right here. When every stage is in, go live: your employees get their logins.")}
            </div>
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Lock className="h-4 w-4" /> {t("Live since")} {project.signedOffAt ? formatDateTime(project.signedOffAt) : ""}
              </span>
            ) : (
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE.STAGED}`}>{t("In progress")}</span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              {t("Go-live date")}
              <input type="date" className={`${TOOL_INPUT} mt-1 block`} value={goLiveDate} disabled={live}
                onChange={(e) => setGoLiveDate(e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">
              {t("Coming from")}
              <select className={`${TOOL_INPUT} mt-1 block`} value={source} disabled={live} onChange={(e) => setSource(e.target.value)}>
                <option value="">{t("Choose...")}</option>
                {SOURCES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
              </select>
            </label>
            {!live && (
              <button type="button" className={SECONDARY_BUTTON} onClick={saveProject} disabled={busy !== null}>{t("Save")}</button>
            )}
            <p className="text-xs text-slate-500">{t("Best on the 1st of a month, ideally the start of the year: fewer opening balances.")}</p>
          </div>
        </div>

        {/* The workbook */}
        {!live && (
          <div className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={CARD_TITLE}>{t("Go-live workbook")}</h2>
                <p className="mt-1 text-xs text-slate-500">{t("One Excel file with a sheet for every kind of record, in order. Fill the sheets you need and upload it: each filled sheet is staged and checked on its own.")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null}
                  onClick={async () => { const b = await run("workbook", () => migrationApi.workbook(), "The workbook could not be downloaded"); if (b) saveBlob(b, "go-live-workbook.xlsx"); }}>
                  <Download className="h-4 w-4" /> {t("Download workbook")}
                </button>
                <label className={`${PRIMARY_BUTTON} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                  <Upload className="h-4 w-4" /> {busy === "workbook-up" ? t("Checking...") : t("Upload filled workbook")}
                  <input ref={workbookInput} type="file" className="sr-only" accept=".xlsx,.xls"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadWorkbook(f); }} />
                </label>
              </div>
            </div>
            {lastUpload && (
              <ul className="space-y-1 text-sm">
                {lastUpload.map((b, i) => (
                  <li key={`${b.type}-${i}`} className="flex flex-wrap items-center gap-2">
                    {b.problemCount === 0 && b.status !== "REFUSED"
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    <span className="font-medium">{t(b.title)}</span>
                    <span className="text-slate-500">{b.rows} {t(b.rows === 1 ? "row" : "rows")}</span>
                    {b.problemCount > 0 && <span className="text-red-600">{b.problemCount} {t(b.problemCount === 1 ? "problem" : "problems")}</span>}
                    {b.status === "REFUSED" && <span className="text-red-600">{b.problems[0]?.message}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* The stages */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <h2 className={CARD_TITLE}>{t("Stages")}</h2>
          </div>
          <ol className="divide-y divide-slate-100 dark:divide-gray-800">
            {project.stages.map((stage: MigrationStage) => (
              <li key={stage.stage} className="flex flex-wrap items-start gap-4 px-4 py-3">
                <div className="flex w-56 shrink-0 items-start gap-2">
                  {stage.status === "COMMITTED" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                    : <Circle className="mt-0.5 h-5 w-5 text-slate-300" />}
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{stage.number}. {t(stage.title)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Chip status={stage.status} />
                      {!stage.required && <span className="text-xs text-slate-400">{t("optional")}</span>}
                    </div>
                    {stage.blockedBy && stage.status !== "COMMITTED" && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("Commit first:")} {t(stage.blockedBy)}</p>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {stage.types.length === 0 && (
                    <span className="text-xs text-slate-400">{stage.number === 7 || stage.number === 8 ? t("Coming later") : t("Nothing to bring in here yet")}</span>
                  )}
                  {stage.types.map((x) => (
                    <div key={x.type} className="w-full rounded-lg border border-slate-100 p-3 sm:w-[300px] dark:border-gray-800">
                      <div className="text-sm font-medium text-slate-800 dark:text-gray-100">{t(x.title)}</div>
                      <p className="mt-1 text-xs text-slate-500">{t(x.description)}</p>
                      {!live && x.columns.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" className={TOOL_BUTTON} disabled={busy !== null}
                            onClick={async () => { const b = await run(`tpl-${x.type}`, () => migrationApi.template(x.type), "The template could not be downloaded"); if (b) saveBlob(b, `${x.type}-migration-template.xlsx`); }}>
                            <Download className="h-3.5 w-3.5" /> {t("Template")}
                          </button>
                          <label className={`${TOOL_BUTTON} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                            <Upload className="h-3.5 w-3.5" /> {busy === `upload-${x.type}` ? t("Checking...") : t("Upload")}
                            <input type="file" className="sr-only" accept=".xlsx,.xls,.csv"
                              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadOne(x.type, f); }} />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* The batches */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <h2 className={CARD_TITLE}>{t("Files")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]">
                <tr>
                  <th className={TH}>{t("What")}</th>
                  <th className={TH}>{t("File")}</th>
                  <th className={TH}>{t("Status")}</th>
                  <th className={TH}>{t("Rows")}</th>
                  <th className={TH}>{t("Preview")}</th>
                  <th className={TH}>{t("Control totals")}</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {batches.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("No file has been uploaded yet.")}</td></tr>
                ) : batches.map((b) => (
                  <Fragment key={b.id}>
                    <tr className={openBatch?.id === b.id ? "bg-cyan-50/40 dark:bg-cyan-950/10" : ""}>
                      <td className={`${TD} whitespace-nowrap font-medium`}>{t(b.title)}</td>
                      <td className={TD}>{b.fileName ?? "—"}</td>
                      <td className={TD}>
                        <Chip status={b.status} />
                        {b.committedAt && b.status === "COMMITTED" && <div className="mt-1 text-xs text-slate-400">{b.committedBy} · {formatDateTime(b.committedAt)}</div>}
                      </td>
                      <td className={TD}>{b.rows}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {b.status === "STAGED" && b.problemCount > 0
                          ? <span className="text-red-600">{b.problemCount} {t(b.problemCount === 1 ? "problem" : "problems")}</span>
                          : <>{b.newCount} {t("new")}, {b.updatedCount} {t("updated")}</>}
                      </td>
                      <td className={`${TD} min-w-[200px] text-xs`}>{totalsText(b.totals)}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        <div className="flex justify-end gap-1">
                          {b.status === "STAGED" && !live && (
                            <>
                              <button type="button" className={TOOL_BUTTON} onClick={() => (openBatch?.id === b.id ? setOpenBatch(null) : openRows(b))}>
                                {openBatch?.id === b.id ? t("Close") : b.problemCount > 0 ? t("Fix") : t("Rows")}
                              </button>
                              <button type="button" className={TOOL_BUTTON} disabled={busy !== null}
                                onClick={async () => afterChange(await run(`check-${b.id}`, () => migrationApi.check(b.id as number), "The batch could not be checked"))}>
                                {t("Check again")}
                              </button>
                              <button type="button" className={TOOL_BUTTON} disabled={busy !== null}
                                onClick={async () => afterChange(await run(`discard-${b.id}`, () => migrationApi.discard(b.id as number), "The batch could not be discarded"), t("Discarded."))}>
                                {t("Discard")}
                              </button>
                              <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null || b.problemCount > 0} onClick={() => commit(b)}>
                                {busy === `commit-${b.id}` ? t("Committing...") : t("Commit")}
                              </button>
                            </>
                          )}
                          {b.status === "COMMITTED" && !live && (
                            <button type="button" className={TOOL_BUTTON} disabled={busy !== null} onClick={() => undo(b)}>{t("Undo")}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openBatch?.id === b.id && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/60 px-3 py-3 dark:bg-[#151515]">
                          {rows.length === 0 ? (
                            <p className="text-sm text-slate-500">{busy?.startsWith("rows-") ? t("Loading...") : t("Every row is correct.")}</p>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-500">{t("Fix the cells below and save the row; the batch is checked again at once.")}</p>
                              <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-100 bg-white dark:border-gray-800 dark:bg-[#191919]">
                                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                                  <thead className="sticky top-0 bg-slate-50 dark:bg-[#222222]">
                                    <tr>
                                      <th className={`${TH} w-14`}>{t("Row")}</th>
                                      <th className={`${TH} min-w-[220px]`}>{t("Problems")}</th>
                                      {columnsOf(b).map((c) => <th key={c} className={`${TH} whitespace-nowrap`}>{c}</th>)}
                                      <th className={TH}></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                    {rows.map((r) => {
                                      const bad = new Set(r.problems.map((p) => p.column));
                                      return (
                                        <tr key={r.id}>
                                          <td className={TD}>{r.row}</td>
                                          <td className={`${TD} text-xs text-red-600`}>
                                            {r.problems.map((p, i) => <div key={i}>{p.column ? <strong>{p.column}: </strong> : null}{p.message}</div>)}
                                          </td>
                                          {columnsOf(b).map((c) => (
                                            <td key={c} className="px-2 py-1">
                                              <input
                                                aria-label={`${t("Row")} ${r.row} ${c}`}
                                                className={`${TOOL_INPUT} w-36 ${bad.has(c) ? "border-red-400 ring-1 ring-red-300" : ""}`}
                                                value={edits[r.id]?.[c] ?? r.values[c] ?? ""}
                                                onChange={(e) => setEdits((all) => ({ ...all, [r.id]: { ...(all[r.id] ?? {}), [c]: e.target.value } }))}
                                              />
                                            </td>
                                          ))}
                                          <td className="px-2 py-1">
                                            <button type="button" className={TOOL_BUTTON} disabled={busy !== null || !edits[r.id] || Object.keys(edits[r.id]).length === 0}
                                              onClick={() => saveRow(r)}>{t("Save")}</button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Go-live */}
        <div className={`${CARD} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className={CARD_TITLE}>{t("Go live")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("Gives every migrated employee a login and an email to set their password, then closes this project.")}</p>
            </div>
            {!live && (
              <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null || project.goLiveBlockers.length > 0} onClick={takeLive}>
                <Rocket className="h-4 w-4" /> {busy === "go-live" ? t("Going live...") : t("Go live")}
              </button>
            )}
          </div>
          {live ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> {t("Live on MyTrade.")} {t("Signed off by")} {project.signedOffBy} {project.signedOffAt ? formatDateTime(project.signedOffAt) : ""}
            </p>
          ) : project.goLiveBlockers.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
              {project.goLiveBlockers.map((x) => <li key={x}>{t(x)}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("Every stage is in: you can go live.")}</p>
          )}
          {goLive && goLive.failures.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              <p className="font-medium">{goLive.loginsCreated} {t("login(s) made;")} {goLive.failures.length} {t("could not be:")}</p>
              <ul className="mt-1 list-inside list-disc">
                {goLive.failures.map((f) => <li key={f.employeeId}><strong>{f.employeeCode ?? f.employeeId}</strong>: {f.message}</li>)}
              </ul>
              <p className="mt-1 text-xs">{t("Fix these, then go live again; employees who have a login are skipped.")}</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
