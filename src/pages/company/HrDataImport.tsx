import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Keyboard, Lock, Rocket, Upload } from "lucide-react";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, PRIMARY_BUTTON, SECONDARY_BUTTON, TOOL_BUTTON, TOOL_INPUT } from "../Payroll/hrmsUi";
import {
  ALERT_BAD, ALERT_GOOD, ALERT_WARN, BAD_TEXT, CARD_HEAD, CHIP_BAD, CHIP_GOOD, CHIP_NEUTRAL, CHIP_WARN, EMPTY, GOOD_TEXT, INTRO, KIND_ICON,
  NOTE, PANEL, TABLE_BOX, TBODY, TD, TH, THEAD, TOOL_SELECT, WARN_TEXT, saveBlob,
} from "./importUi";
import {
  GoLiveResult, MappingView, MigrationBatch, MigrationColumn, MigrationProject, MigrationRow, MigrationStage, MissingRecord, ParallelRunReport, RunFigure, UnmatchedValue, migrationApi,
} from "../../migration/migrationApi";
import { t } from "../../i18n/i18n";

const SOURCES = ["Manual records", "Keka", "greytHR", "Zoho People", "Darwinbox", "Bayzat", "Other"];

// The same words as the business-records imports: a file is checked, then imported
const STATUS_STYLE: Record<string, string> = {
  COMMITTED: CHIP_GOOD, STAGED: CHIP_WARN, NOT_STARTED: CHIP_NEUTRAL, DISCARDED: CHIP_NEUTRAL, UNDONE: CHIP_NEUTRAL, REFUSED: CHIP_BAD,
};
const STATUS_LABEL: Record<string, string> = {
  COMMITTED: "Imported", STAGED: "Checked, not imported", NOT_STARTED: "Not started", DISCARDED: "Discarded", UNDONE: "Undone", REFUSED: "Refused",
};

function Chip({ status }: { status: string }) {
  return <span className={STATUS_STYLE[status] ?? CHIP_NEUTRAL}>{t(STATUS_LABEL[status] ?? status)}</span>;
}

const totalsText = (totals: Record<string, number>) =>
  Object.entries(totals).map(([k, v]) => `${t(k)}: ${Number(v).toLocaleString()}`).join(" · ");

/**
 * Data Import → HR, payroll & attendance: bring a company's HR, payroll, leave and attendance records in from its old
 * system step by step. Files are checked first (nothing reaches live records), problems are fixed in place, each step
 * is imported in order, and going live gives the migrated employees their logins. {@code refreshKey} changes when the
 * page's Refresh is clicked.
 */
export default function HrDataImport({ refreshKey = 0 }: { refreshKey?: number }) {
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
  // Values the open batch was refused for, and what HR says they mean (the value dictionary)
  const [unmatched, setUnmatched] = useState<UnmatchedValue[]>([]);
  const [meanings, setMeanings] = useState<Record<string, string>>({});
  // Records the open batch refers to that don't exist yet, which of them to create, and a designation's pay split
  const [missing, setMissing] = useState<MissingRecord[]>([]);
  const [toCreate, setToCreate] = useState<Record<string, { on: boolean; basic: string; hra: string }>>({});
  const [goLive, setGoLive] = useState<GoLiveResult | null>(null);
  // Another system's export: its headers mapped to our columns before it is uploaded
  // The entry grid: rows typed or pasted in, for a company without a file
  // The parallel run: the register's months, the chosen one, and the comparison
  const [runMonths, setRunMonths] = useState<string[]>([]);
  const [runMonth, setRunMonth] = useState("");
  const [runReport, setRunReport] = useState<ParallelRunReport | null>(null);
  const [grid, setGrid] = useState<{ type: string; title: string; columns: MigrationColumn[]; rows: string[][] } | null>(null);
  const [mappingFor, setMappingFor] = useState<{ type: string; title: string; file: File; view: MappingView;
    choice: Record<string, string>; remember: boolean } | null>(null);
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

  useEffect(() => { load(); }, [load, refreshKey]);

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
    const saved = await run("project", () => migrationApi.saveProject(goLiveDate || null, source || null), "The details could not be saved");
    if (saved) {
      setProject(saved);
      ToasterService.success("Saved.");
    }
  };

  const openRows = async (batch: MigrationBatch) => {
    if (batch.id == null) return;
    setOpenBatch(batch);
    setEdits({});
    const list = await run(`rows-${batch.id}`, () => migrationApi.rows(batch.id as number, batch.status === "STAGED"), "The rows could not be loaded");
    setRows(list ?? []);
    setMeanings({});
    setUnmatched(batch.status === "STAGED" && batch.problemCount > 0
      ? await migrationApi.unmatched(batch.id as number).catch(() => []) : []);
    await loadMissing(batch);
  };

  const missingKey = (m: MissingRecord) => `${m.type}\u0000${m.name}`;

  const loadMissing = async (batch: MigrationBatch) => {
    const list = batch.status === "STAGED" && batch.problemCount > 0 && batch.id != null
      ? await migrationApi.missing(batch.id).catch(() => []) : [];
    setMissing(list);
    setToCreate(Object.fromEntries(list.map((m) => [missingKey(m), { on: true, basic: "", hra: "" }])));
  };

  const chosenMissing = missing.filter((m) => toCreate[missingKey(m)]?.on);
  const splitMissing = chosenMissing.some((m) => m.type === "designations"
    && (!toCreate[missingKey(m)].basic.trim() || !toCreate[missingKey(m)].hra.trim()));

  /** Creates the ticked records (each kind as its own batch, so they can be undone), then checks this batch again. */
  const createMissing = async () => {
    if (!openBatch?.id || chosenMissing.length === 0) return;
    const id = openBatch.id;
    const records = chosenMissing.map((m) => ({ type: m.type, name: m.name,
      values: m.type === "designations" ? { basic: toCreate[missingKey(m)].basic.trim(), hra: toCreate[missingKey(m)].hra.trim() } : undefined }));
    const result = await run(`create-${id}`, () => migrationApi.createMissing(id, records), "The records could not be created");
    if (result) {
      const waiting = result.created.filter((b) => b.status !== "COMMITTED");
      if (waiting.length > 0) {
        ToasterService.error(`${t("Checked but not imported")}: ${waiting.map((b) => t(b.title)).join(", ")}`);
      }
      await afterChange(result.batch, `${records.length} ${t(records.length === 1 ? "record created." : "records created.")}`);
      await loadMissing(result.batch);
      setUnmatched(result.batch.problemCount > 0 ? await migrationApi.unmatched(id).catch(() => []) : []);
    }
  };

  const valueKey = (u: UnmatchedValue) => `${u.field}\u0000${u.value}`;

  /** Adds the meanings to the company's dictionary, then checks the open batch again. */
  const saveMeanings = async () => {
    if (!openBatch?.id) return;
    const entries = unmatched.filter((u) => (meanings[valueKey(u)] ?? "").trim())
      .map((u) => ({ field: u.field, source: u.value, target: meanings[valueKey(u)].trim() }));
    if (entries.length === 0) return;
    const id = openBatch.id;
    const checked = await run(`dictionary-${id}`, async () => {
      await migrationApi.saveDictionary(entries);
      return migrationApi.check(id);
    }, "The translations could not be saved");
    if (checked) {
      await afterChange(checked, `${entries.length} ${t(entries.length === 1 ? "translation saved." : "translations saved.")}`);
      setMeanings({});
      setUnmatched(checked.problemCount > 0 ? await migrationApi.unmatched(id).catch(() => []) : []);
      // A translated value may now point at a record that doesn't exist yet
      await loadMissing(checked);
    }
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

  const stageFile = async (type: string, picked: File, mapping?: Record<string, string>, remember = false) => {
    const staged = await run(`upload-${type}`, () => migrationApi.upload(type, picked, mapping, remember), "The file could not be checked");
    if (staged) {
      setMappingFor(null);
      setLastUpload([staged]);
      await load();
      if (staged.id != null) openRows(staged);
    }
  };

  /** Our template (or a file the saved mapping knows) goes straight in; anything else is mapped first. */
  const uploadOne = async (type: string, title: string, picked: File) => {
    const view = await run(`upload-${type}`, () => migrationApi.mapping(type, picked), "The file could not be read");
    if (!view) return;
    // Our template's names, the company's saved mapping or the ready-made one for its system: no need to ask
    const known = view.headers.every((h) => h.how === "EXACT" || h.how === "PROFILE" || h.how === "READY" || h.header.trim() === "");
    if (known && view.missingRequired.length === 0 && view.problems.length === 0) {
      await stageFile(type, picked);
      return;
    }
    const choice: Record<string, string> = {};
    view.headers.forEach((h) => { if (h.header.trim()) choice[h.header] = h.key ?? ""; });
    setMappingFor({ type, title, file: picked, view, choice, remember: !!view.sourceSystem });
  };

  const registerCommitted = project?.stages.some((s) => s.stage === "PARALLEL_RUN" && s.status === "COMMITTED") ?? false;

  useEffect(() => {
    if (!registerCommitted) return;
    migrationApi.parallelRunMonths().then((months) => {
      setRunMonths(months);
      setRunMonth((m) => m || months[months.length - 1] || "");
    }).catch(() => setRunMonths([]));
  }, [registerCommitted]);

  const compare = async () => {
    if (!runMonth) return;
    const report = await run("parallel", () => migrationApi.parallelRun(runMonth), "The parallel run could not be worked out");
    if (report) setRunReport(report);
  };

  const signOff = async (role: "HR" | "FINANCE") => {
    const done = await run(`signoff-${role}`, () => migrationApi.signOffParallelRun(role), "The sign-off could not be saved");
    if (done) {
      ToasterService.success(role === "HR" ? t("HR signed off the parallel run.") : t("Finance signed off the parallel run."));
      load();
    }
  };

  const money = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }));
  const diffCell = (f: RunFigure) => (
    <td className={`${TD} whitespace-nowrap text-end`}>
      <div>{money(f.oldSystem)} → {money(f.myTrade)}</div>
      {f.difference != null && Math.abs(f.difference) > 1 && (
        <div className={`text-xs font-medium ${BAD_TEXT}`}>{f.difference > 0 ? "+" : ""}{money(f.difference)}</div>
      )}
    </td>
  );

  const emptyRow = (n: number) => Array.from({ length: n }, () => "");

  const openGrid = (type: string, title: string, columns: MigrationColumn[]) => {
    setMappingFor(null);
    setGrid({ type, title, columns, rows: Array.from({ length: 5 }, () => emptyRow(columns.length)) });
  };

  const setCell = (r: number, c: number, value: string) =>
    setGrid((g) => g && ({ ...g, rows: g.rows.map((row, i) => (i === r ? row.map((v, j) => (j === c ? value : v)) : row)) }));

  /** A block copied from Excel (tabs between cells, a line per row) fills down and across from this cell. */
  const pasteBlock = (r: number, c: number, text: string): boolean => {
    if (!grid || (!text.includes("\t") && !text.includes("\n"))) return false;
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    setGrid((g) => {
      if (!g) return g;
      const rows = g.rows.map((row) => [...row]);
      block.forEach((cells, i) => {
        while (rows.length <= r + i) rows.push(emptyRow(g.columns.length));
        cells.forEach((value, j) => { if (c + j < g.columns.length) rows[r + i][c + j] = value.trim(); });
      });
      return { ...g, rows };
    });
    return true;
  };

  const filledRows = grid ? grid.rows.filter((row) => row.some((v) => v.trim())).length : 0;

  const checkGrid = async () => {
    if (!grid) return;
    const rows = grid.rows.map((row) => Object.fromEntries(grid.columns.map((col, i) => [col.header, row[i] ?? ""])));
    const staged = await run(`grid-${grid.type}`, () => migrationApi.enter(grid.type, rows), "The rows could not be checked");
    if (staged) {
      setGrid(null);
      setLastUpload([staged]);
      await load();
      if (staged.id != null) openRows(staged);
    }
  };

  const mappedMissing = mappingFor
    ? mappingFor.view.columns.filter((c) => c.required && !Object.values(mappingFor.choice).includes(c.key)).map((c) => c.header)
    : [];
  const mappedTwice = mappingFor
    ? Object.values(mappingFor.choice).filter((k, i, all) => k && all.indexOf(k) !== i)
    : [];

  const uploadWorkbook = async (picked: File) => {
    const staged = await run("workbook-up", () => migrationApi.uploadWorkbook(picked), "The workbook could not be checked");
    if (workbookInput.current) workbookInput.current.value = "";
    if (staged) {
      setLastUpload(staged);
      await load();
    }
  };

  const commit = async (batch: MigrationBatch) => {
    const done = await run(`commit-${batch.id}`, () => migrationApi.commit(batch.id as number), "The import failed; nothing was saved");
    if (done?.status === "COMMITTED") {
      afterChange(done, `${t(done.title)}: ${t("Imported")} ${done.newCount} ${t("new")}, ${done.updatedCount} ${t("updated")}.`);
    } else if (done) {
      ToasterService.error("Nothing was imported: the file has problems.");
      afterChange(done);
    }
  };

  const undo = async (batch: MigrationBatch) => {
    const ok = await confirm({
      title: t("Undo this import?"),
      message: t("The records this import created are removed; records it updated keep their new values."),
      confirmLabel: t("Undo"),
      variant: "danger",
    });
    if (ok) afterChange(await run(`undo-${batch.id}`, () => migrationApi.undo(batch.id as number), "The import could not be undone"), t("Undone."));
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
    return <div className={`${CARD} p-8 text-center text-sm ${BAD_TEXT}`}>{t("The HR, payroll and attendance import could not be loaded.")} {loadError}</div>;
  }
  if (!project) {
    return <div className={`${CARD} p-8 text-center ${EMPTY}`}>{t("Loading...")}</div>;
  }

  const columnsOf = (batch: MigrationBatch) =>
    project.stages.flatMap((s) => s.types).find((x) => x.type === batch.type)?.columns.map((c) => c.header)
      ?? Object.keys(rows[0]?.values ?? {});

  return (
    <>
      <div className="space-y-4">
        {/* The project */}
        <div className={`${INTRO} space-y-3`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              {t("Bring your HR, payroll, leave and attendance records in from your old system, step by step: download a template, fill it in and upload it, or type the rows in. Every row is checked first, and nothing is saved until you import it; problems are fixed right here. When every step is in, go live: your employees get their logins.")}
            </div>
            {live ? (
              <span className={CHIP_GOOD}>
                <Lock className="h-3.5 w-3.5" /> {t("Live since")} {project.signedOffAt ? formatDateTime(project.signedOffAt) : ""}
              </span>
            ) : (
              <span className={CHIP_WARN}>{t("In progress")}</span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className={NOTE}>
              {t("Go-live date")}
              <input type="date" className={`${TOOL_INPUT} mt-1 block`} value={goLiveDate} disabled={live}
                onChange={(e) => setGoLiveDate(e.target.value)} />
            </label>
            <label className={NOTE}>
              {t("Coming from")}
              <select className={`${TOOL_SELECT} mt-1 block`} value={source} disabled={live} onChange={(e) => setSource(e.target.value)}>
                <option value="">{t("Choose...")}</option>
                {SOURCES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
              </select>
            </label>
            {!live && (
              <button type="button" className={SECONDARY_BUTTON} onClick={saveProject} disabled={busy !== null}>{t("Save")}</button>
            )}
            <p className={NOTE}>{t("Best on the 1st of a month, ideally the start of the year: fewer opening balances.")}</p>
          </div>
        </div>

        {/* The workbook */}
        {!live && (
          <div className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={CARD_TITLE}>{t("Everything in one workbook")}</h2>
                <p className={`mt-1 ${NOTE}`}>{t("One Excel file with a sheet for every kind of record, in order. Fill the sheets you need and upload it: each filled sheet is checked on its own.")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null}
                  onClick={async () => { const b = await run("workbook", () => migrationApi.workbook(), "The workbook could not be downloaded"); if (b) saveBlob(b, "hr-payroll-attendance-import-workbook.xlsx"); }}>
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
                      ? <CheckCircle2 className={`h-4 w-4 ${GOOD_TEXT}`} /> : <AlertTriangle className={`h-4 w-4 ${WARN_TEXT}`} />}
                    <span className="font-medium text-slate-800 dark:text-gray-100">{t(b.title)}</span>
                    <span className="text-slate-500 dark:text-gray-400">{b.rows} {t(b.rows === 1 ? "row" : "rows")}</span>
                    {b.problemCount > 0 && <span className={BAD_TEXT}>{b.problemCount} {t(b.problemCount === 1 ? "problem" : "problems")}</span>}
                    {b.status === "REFUSED" && <span className={BAD_TEXT}>{b.problems[0]?.message}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* The stages */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEAD}>
            <h2 className={CARD_TITLE}>{t("What to import, in order")}</h2>
            <p className={`mt-1 ${NOTE}`}>{t("Each step needs the one before it imported first.")}</p>
          </div>
          <ol className="divide-y divide-slate-100 dark:divide-gray-800">
            {project.stages.map((stage: MigrationStage) => {
              const done = stage.status === "COMMITTED";
              const waiting = !!stage.blockedBy && !done;
              return (
                <li key={stage.stage} className="grid gap-3 px-4 py-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-5">
                  {/* The step: its number (a tick once imported), name, status and what it waits for */}
                  <div className="flex items-start gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : waiting ? "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"
                        : "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-900"}`}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : stage.number}
                    </span>
                    <div className="min-w-0">
                      <div className={CARD_TITLE}>{t(stage.title)}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Chip status={stage.status} />
                        {!stage.required && <span className={CHIP_NEUTRAL}>{t("Optional")}</span>}
                      </div>
                      {waiting && (
                        <p className={`mt-1.5 flex items-center gap-1 text-xs ${WARN_TEXT}`}>
                          <Lock className="h-3 w-3 shrink-0" /> {t("Import first:")} {t(stage.blockedBy as string)}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* What the step brings in: one card each, the same size, actions along the bottom */}
                  {stage.types.length === 0 ? (
                    <div className={`flex items-center rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs dark:border-gray-700 ${EMPTY}`}>
                      {stage.number === 7 || stage.number === 8 ? t("Coming later") : t("Nothing to bring in here yet")}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {stage.types.map((x) => (
                        <div key={x.type} className={`${PANEL} flex h-full flex-col`}>
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className={KIND_ICON} />
                            <span className={CARD_TITLE}>{t(x.title)}</span>
                          </div>
                          <p className={`mt-1.5 flex-1 ${NOTE}`}>{t(x.description)}</p>
                          {!live && x.columns.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-gray-800">
                              <button type="button" className={`${TOOL_BUTTON} w-full justify-center`} disabled={busy !== null}
                                title={t("Download template")} aria-label={`${t("Download template")}: ${t(x.title)}`}
                                onClick={async () => { const b = await run(`tpl-${x.type}`, () => migrationApi.template(x.type), "The template could not be downloaded"); if (b) saveBlob(b, `${x.type}-migration-template.xlsx`); }}>
                                <Download className="h-3.5 w-3.5 shrink-0" /> {t("Template")}
                              </button>
                              <label className={`${TOOL_BUTTON} w-full cursor-pointer justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}
                                title={t("Upload filled file")}>
                                <Upload className="h-3.5 w-3.5 shrink-0" /> {busy === `upload-${x.type}` ? t("Checking...") : t("Upload")}
                                <input type="file" className="sr-only" accept=".xlsx,.xls,.csv" aria-label={`${t("Upload filled file")}: ${t(x.title)}`}
                                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadOne(x.type, x.title, f); }} />
                              </label>
                              <button type="button" className={`${TOOL_BUTTON} w-full justify-center`} disabled={busy !== null}
                                title={t("Type the rows in")} aria-label={`${t("Type the rows in")}: ${t(x.title)}`} onClick={() => openGrid(x.type, x.title, x.columns)}>
                                <Keyboard className="h-3.5 w-3.5 shrink-0" /> {t("Type in")}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Typing rows in */}
        {grid && (
          <div className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={CARD_TITLE}>{t("Type in")}: {t(grid.title)}</h2>
                <p className={`mt-1 ${NOTE}`}>
                  {t("One row per record; columns marked * must be filled. You can paste a block copied from Excel into any cell.")}
                </p>
              </div>
              <button type="button" className={TOOL_BUTTON} onClick={() => setGrid(null)}>{t("Cancel")}</button>
            </div>
            {grid.columns.filter((col) => col.choices.length > 0).map((col) => (
              <datalist key={col.key} id={`grid-${grid.type}-${col.key}`}>
                {col.choices.map((choice) => <option key={choice} value={choice} />)}
              </datalist>
            ))}
            <div className={`${TABLE_BOX} max-h-[480px]`}>
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className={`sticky top-0 ${THEAD}`}>
                  <tr>
                    <th className={`${TH} w-10`}>#</th>
                    {grid.columns.map((col) => (
                      <th key={col.key} className={`${TH} whitespace-nowrap`} title={col.note ?? undefined}>{col.header}{col.required ? " *" : ""}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {grid.rows.map((row, r) => (
                    <tr key={r}>
                      <td className={`${TD} text-xs text-slate-400 dark:text-gray-500`}>{r + 1}</td>
                      {grid.columns.map((col, c) => (
                        <td key={col.key} className="px-1 py-1">
                          <input aria-label={`${t("Row")} ${r + 1} ${col.header}`} className={`${TOOL_INPUT} w-36`}
                            placeholder={r === 0 ? col.example ?? "" : ""} value={row[c] ?? ""}
                            list={col.choices.length > 0 ? `grid-${grid.type}-${col.key}` : undefined}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            onPaste={(e) => { if (pasteBlock(r, c, e.clipboardData.getData("text"))) e.preventDefault(); }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" className={TOOL_BUTTON}
                onClick={() => setGrid((g) => g && ({ ...g, rows: [...g.rows, ...Array.from({ length: 5 }, () => emptyRow(g.columns.length))] }))}>
                {t("Add 5 rows")}
              </button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null || filledRows === 0} onClick={checkGrid}>
                {busy === `grid-${grid.type}` ? t("Checking...") : `${t("Check")} ${filledRows} ${t(filledRows === 1 ? "row" : "rows")}`}
              </button>
            </div>
          </div>
        )}

        {/* Mapping another system's columns */}
        {mappingFor && (
          <div className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={CARD_TITLE}>{t("Match the columns")}: {t(mappingFor.title)} · {mappingFor.file.name}</h2>
                <p className={`mt-1 ${NOTE}`}>
                  {t("The file's own headers, matched to MyTrade's columns. Check the suggestions, choose a column for the rest or ignore them.")}
                  {mappingFor.view.profileUsed && <> {t("Your saved mapping for")} {mappingFor.view.sourceSystem} {t("was used.")}</>}
                </p>
              </div>
              <button type="button" className={TOOL_BUTTON} onClick={() => setMappingFor(null)}>{t("Cancel")}</button>
            </div>
            {mappingFor.view.problems.length > 0 && (
              <p className={`text-sm ${BAD_TEXT}`}>{mappingFor.view.problems.map((p) => p.message).join(" ")}</p>
            )}
            <div className={`${TABLE_BOX} max-h-[420px]`}>
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className={`sticky top-0 ${THEAD}`}>
                  <tr>
                    <th className={TH}>{t("In your file")}</th>
                    <th className={TH}>{t("MyTrade column")}</th>
                    <th className={TH}>{t("Found by")}</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {mappingFor.view.headers.filter((h) => h.header.trim()).map((h) => {
                    const how = h.how === "FUZZY" ? "Similar spelling: check it" : h.how === "SYNONYM" ? "Known name"
                      : h.how === "PROFILE" ? "Saved mapping" : h.how === "READY" ? `Built-in for ${mappingFor.view.readyProfile ?? ""}`
                      : h.how === "EXACT" ? "Same name" : "Not matched";
                    return (
                      <tr key={h.header} className={h.how === "FUZZY" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                        <td className={`${TD} whitespace-nowrap font-medium`}>{h.header}</td>
                        <td className="px-3 py-1">
                          <select aria-label={`${t("Column for")} ${h.header}`} className={TOOL_SELECT} value={mappingFor.choice[h.header] ?? ""}
                            onChange={(e) => setMappingFor((m) => m && ({ ...m, choice: { ...m.choice, [h.header]: e.target.value } }))}>
                            <option value="">{t("Ignore this column")}</option>
                            {mappingFor.view.columns.map((c) => (
                              <option key={c.key} value={c.key}>{c.header}{c.required ? " *" : ""}</option>
                            ))}
                          </select>
                        </td>
                        <td className={`${TD} text-xs ${h.how === "FUZZY" ? WARN_TEXT : "text-slate-500 dark:text-gray-400"}`}>{t(how)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {mappedMissing.length > 0 && (
              <p className={`text-sm ${WARN_TEXT}`}>{t("Still needed")}: {mappedMissing.join(", ")}</p>
            )}
            {mappedTwice.length > 0 && (
              <p className={`text-sm ${BAD_TEXT}`}>{t("A column is chosen twice")}: {[...new Set(mappedTwice)].join(", ")}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className={`flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200 ${mappingFor.view.sourceSystem ? "" : "opacity-60"}`}>
                <input type="checkbox" checked={mappingFor.remember} disabled={!mappingFor.view.sourceSystem}
                  onChange={(e) => setMappingFor((m) => m && ({ ...m, remember: e.target.checked }))} />
                {mappingFor.view.sourceSystem
                  ? `${t("Remember this for files from")} ${mappingFor.view.sourceSystem}`
                  : t("Choose where the files come from (above) to remember this mapping")}
              </label>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null || mappedMissing.length > 0 || mappedTwice.length > 0}
                onClick={() => stageFile(mappingFor.type, mappingFor.file, mappingFor.choice, mappingFor.remember)}>
                <Upload className="h-4 w-4" /> {t("Upload with these columns")}
              </button>
            </div>
          </div>
        )}

        {/* The batches */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEAD}>
            <h2 className={CARD_TITLE}>{t("Files uploaded")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("What")}</th>
                  <th className={TH}>{t("File")}</th>
                  <th className={TH}>{t("Status")}</th>
                  <th className={TH}>{t("Rows")}</th>
                  <th className={TH}>{t("Result")}</th>
                  <th className={TH}>{t("Control totals")}</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {batches.length === 0 ? (
                  <tr><td colSpan={7} className={`px-3 py-8 text-center ${EMPTY}`}>{t("No file has been uploaded yet.")}</td></tr>
                ) : batches.map((b) => (
                  <Fragment key={b.id}>
                    <tr className={openBatch?.id === b.id ? "bg-cyan-50/40 dark:bg-cyan-950/10" : ""}>
                      <td className={`${TD} whitespace-nowrap font-medium`}>{t(b.title)}</td>
                      <td className={TD}>{b.fileName ?? "—"}</td>
                      <td className={TD}>
                        <Chip status={b.status} />
                        {b.committedAt && b.status === "COMMITTED" && <div className="mt-1 text-xs text-slate-400 dark:text-gray-500">{b.committedBy} · {formatDateTime(b.committedAt)}</div>}
                        {b.rowsDeletedAt && <div className="mt-1 text-xs text-slate-400 dark:text-gray-500">{t("Uploaded values deleted")} {formatDateTime(b.rowsDeletedAt)}</div>}
                      </td>
                      <td className={TD}>{b.rows}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {b.status === "STAGED" && b.problemCount > 0
                          ? <span className={BAD_TEXT}>{b.problemCount} {t(b.problemCount === 1 ? "problem" : "problems")}</span>
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
                                {busy === `commit-${b.id}` ? t("Importing...") : t("Import")}
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
                            <p className="text-sm text-slate-500 dark:text-gray-400">{busy?.startsWith("rows-") ? t("Loading...") : t("Every row is correct.")}</p>
                          ) : (
                            <div className="space-y-2">
                              {missing.length > 0 && (
                                <div className={`${ALERT_WARN} space-y-2`}>
                                  <p className="font-medium">
                                    {t("Not in MyTrade yet")}: {t("create")} {missing.length}?
                                  </p>
                                  <p className="text-xs">{t("Each kind is created as its own file in its stage, so it can be undone like any other.")}</p>
                                  <ul className="space-y-1">
                                    {missing.map((m) => {
                                      const k = missingKey(m);
                                      const state = toCreate[k] ?? { on: false, basic: "", hra: "" };
                                      return (
                                        <li key={k} className="flex flex-wrap items-center gap-2 text-sm">
                                          <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={state.on}
                                              onChange={(e) => setToCreate((all) => ({ ...all, [k]: { ...state, on: e.target.checked } }))} />
                                            <span>{t(m.title)}:</span> <strong>{m.name}</strong>
                                            <span className="text-xs opacity-75">({m.rows} {t(m.rows === 1 ? "row" : "rows")})</span>
                                          </label>
                                          {m.type === "designations" && state.on && (
                                            <>
                                              <input aria-label={`${t("Basic %")} ${m.name}`} className={`${TOOL_INPUT} w-24`} placeholder={t("Basic %")}
                                                value={state.basic} onChange={(e) => setToCreate((all) => ({ ...all, [k]: { ...state, basic: e.target.value } }))} />
                                              <input aria-label={`${t("HRA %")} ${m.name}`} className={`${TOOL_INPUT} w-24`} placeholder={t("HRA % of basic")}
                                                value={state.hra} onChange={(e) => setToCreate((all) => ({ ...all, [k]: { ...state, hra: e.target.value } }))} />
                                            </>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  <button type="button" className={SECONDARY_BUTTON}
                                    disabled={busy !== null || chosenMissing.length === 0 || splitMissing} onClick={createMissing}>
                                    {t("Create")} {chosenMissing.length} {t("and check again")}
                                  </button>
                                  {splitMissing && <p className="text-xs font-medium">{t("A designation needs its basic % and HRA %.")}</p>}
                                </div>
                              )}
                              {unmatched.length > 0 && (
                                <div className={`${PANEL} space-y-2`}>
                                  <p className="text-sm font-medium text-slate-800 dark:text-gray-100">{t("Translate values")}</p>
                                  <p className={NOTE}>{t("Say what your old system's values mean once; every row using them is fixed, now and in later files.")}</p>
                                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {unmatched.map((u) => (
                                      <label key={valueKey(u)} className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="min-w-[150px] text-slate-600 dark:text-gray-300">
                                          {u.column}: <strong>{u.value}</strong> <span className="text-xs text-slate-400 dark:text-gray-500">({u.rows} {t(u.rows === 1 ? "row" : "rows")})</span>
                                        </span>
                                        {u.choices.length > 0 ? (
                                          <select aria-label={`${t("Meaning of")} ${u.value}`} className={TOOL_SELECT} value={meanings[valueKey(u)] ?? ""}
                                            onChange={(e) => setMeanings((m) => ({ ...m, [valueKey(u)]: e.target.value }))}>
                                            <option value="">{t("Means...")}</option>
                                            {u.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                                          </select>
                                        ) : (
                                          <input aria-label={`${t("Meaning of")} ${u.value}`} className={`${TOOL_INPUT} w-44`} placeholder={t("Means...")}
                                            value={meanings[valueKey(u)] ?? ""}
                                            onChange={(e) => setMeanings((m) => ({ ...m, [valueKey(u)]: e.target.value }))} />
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                  <button type="button" className={SECONDARY_BUTTON}
                                    disabled={busy !== null || !Object.values(meanings).some((v) => v.trim())} onClick={saveMeanings}>
                                    {t("Save translations and check again")}
                                  </button>
                                </div>
                              )}
                              <p className={NOTE}>{t("Fix the cells below and save the row; the file is checked again at once.")}</p>
                              <div className={`${TABLE_BOX} max-h-[480px] bg-white dark:bg-[#191919]`}>
                                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                                  <thead className={`sticky top-0 ${THEAD}`}>
                                    <tr>
                                      <th className={`${TH} w-14`}>{t("Row")}</th>
                                      <th className={`${TH} min-w-[220px]`}>{t("Problems")}</th>
                                      {columnsOf(b).map((c) => <th key={c} className={`${TH} whitespace-nowrap`}>{c}</th>)}
                                      <th className={TH}></th>
                                    </tr>
                                  </thead>
                                  <tbody className={TBODY}>
                                    {rows.map((r) => {
                                      const bad = new Set(r.problems.map((p) => p.column));
                                      return (
                                        <tr key={r.id}>
                                          <td className={TD}>{r.row}</td>
                                          <td className={`${TD} text-xs ${BAD_TEXT}`}>
                                            {r.problems.map((p, i) => <div key={i}>{p.column ? <strong>{p.column}: </strong> : null}{p.message}</div>)}
                                          </td>
                                          {columnsOf(b).map((c) => (
                                            <td key={c} className="px-2 py-1">
                                              <input
                                                aria-label={`${t("Row")} ${r.row} ${c}`}
                                                className={`${TOOL_INPUT} w-36 ${bad.has(c) ? "border-red-400 ring-1 ring-red-300 dark:border-red-700 dark:ring-red-800" : ""}`}
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

        {/* Parallel run */}
        {registerCommitted && (
          <div className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className={CARD_TITLE}>{t("Parallel run")}</h2>
                <p className={`mt-1 ${NOTE}`}>
                  {t("MyTrade works out a month the old system paid, as a dry run (nothing saved, nothing paid), and compares it with the old payroll register. Differences above 1 are flagged with the likely reason.")}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className={NOTE}>
                  {t("Month")}
                  <select className={`${TOOL_SELECT} mt-1 block`} value={runMonth} onChange={(e) => { setRunMonth(e.target.value); setRunReport(null); }}>
                    {runMonths.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null || !runMonth} onClick={compare}>
                  {busy === "parallel" ? t("Working out...") : t("Compare")}
                </button>
              </div>
            </div>
            {runReport && (
              <>
                <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-gray-200">
                  <span>{runReport.employees} {t("employees")}</span>
                  <span className={runReport.flagged > 0 ? `font-medium ${BAD_TEXT}` : GOOD_TEXT}>{runReport.flagged} {t("flagged")}</span>
                  <span>{t("Net pay")}: {money(runReport.oldNet)} → {money(runReport.myTradeNet)}</span>
                  <span>{t("TDS")}: {money(runReport.oldTds)} → {money(runReport.myTradeTds)}</span>
                </div>
                <div className={`${TABLE_BOX} max-h-[480px]`}>
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className={`sticky top-0 ${THEAD}`}>
                      <tr>
                        <th className={TH}>{t("Employee")}</th>
                        <th className={`${TH} text-end`}>{t("Gross")}</th>
                        <th className={`${TH} text-end`}>{t("PF")}</th>
                        <th className={`${TH} text-end`}>{t("TDS")}</th>
                        <th className={`${TH} text-end`}>{t("Net pay")}</th>
                        <th className={TH}>{t("Why")}</th>
                      </tr>
                    </thead>
                    <tbody className={TBODY}>
                      {runReport.lines.map((line) => (
                        <tr key={line.employeeId} className={line.flagged ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                          <td className={`${TD} whitespace-nowrap`}>
                            <div className="font-medium">{line.employeeCode ?? line.employeeId}</div>
                            <div className="text-xs text-slate-400 dark:text-gray-500">{line.employeeName}</div>
                          </td>
                          {diffCell(line.gross)}
                          {diffCell(line.pf)}
                          {diffCell(line.tds)}
                          {diffCell(line.net)}
                          <td className={`${TD} min-w-[260px] text-xs`}>
                            {line.reasons.length === 0
                              ? <span className={GOOD_TEXT}>{t("Same")}</span>
                              : line.reasons.map((r, i) => <div key={i}>{t(r)}</div>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm dark:border-gray-800">
              <span className="text-slate-500 dark:text-gray-400">{t("Sign-off")}:</span>
              {project.hrSignedOffBy ? (
                <span className={GOOD_TEXT}>{t("HR")}: {project.hrSignedOffBy} {project.hrSignedOffAt ? formatDateTime(project.hrSignedOffAt) : ""}</span>
              ) : (
                <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null || live} onClick={() => signOff("HR")}>{t("Sign off for HR")}</button>
              )}
              {project.financeSignedOffBy ? (
                <span className={GOOD_TEXT}>{t("Finance")}: {project.financeSignedOffBy} {project.financeSignedOffAt ? formatDateTime(project.financeSignedOffAt) : ""}</span>
              ) : (
                <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null || live} onClick={() => signOff("FINANCE")}>{t("Sign off for finance")}</button>
              )}
            </div>
          </div>
        )}

        {/* Go-live */}
        <div className={`${CARD} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className={CARD_TITLE}>{t("Go live")}</h2>
              <p className={`mt-1 ${NOTE}`}>{t("Gives every migrated employee a login and an email to set their password, then closes this project.")}</p>
            </div>
            {!live && (
              <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null || project.goLiveBlockers.length > 0} onClick={takeLive}>
                <Rocket className="h-4 w-4" /> {busy === "go-live" ? t("Going live...") : t("Go live")}
              </button>
            )}
          </div>
          {live ? (
            <p className={`flex items-center gap-2 text-sm ${GOOD_TEXT}`}>
              <CheckCircle2 className="h-4 w-4" /> {t("Live on MyTrade.")} {t("Signed off by")} {project.signedOffBy} {project.signedOffAt ? formatDateTime(project.signedOffAt) : ""}
            </p>
          ) : project.goLiveBlockers.length > 0 ? (
            <ul className={`${ALERT_WARN} list-inside list-disc`}>
              {project.goLiveBlockers.map((x) => <li key={x}>{t(x)}</li>)}
            </ul>
          ) : (
            <p className={ALERT_GOOD}>{t("Every step is in: you can go live.")}</p>
          )}
          {goLive && goLive.failures.length > 0 && (
            <div className={ALERT_BAD}>
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
