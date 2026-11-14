// Go-live (tenant data migration): common-service's coordinator stages files, checks them, commits them stage by
// stage, and takes the company live. See My_Trade_Services/docs/HRMS-TENANT-DATA-MIGRATION.md.
import axios from "axios";

const BASE = "/v1/api/common/migration";

export interface MigrationColumn {
  key: string;
  header: string;
  required: boolean;
  example: string | null;
  note: string | null;
  choices: string[];
}

export interface MigrationType {
  type: string;
  title: string;
  description: string;
  /** Empty when the service that owns it can't be reached (the description says so). */
  columns: MigrationColumn[];
}

export type StageStatus = "NOT_STARTED" | "STAGED" | "COMMITTED";

export interface MigrationStage {
  number: number;
  stage: string;
  title: string;
  required: boolean;
  status: StageStatus;
  /** An earlier required stage not committed yet. */
  blockedBy: string | null;
  types: MigrationType[];
}

export interface MigrationProject {
  id: number;
  goLiveDate: string | null;
  sourceSystem: string | null;
  status: "IN_PROGRESS" | "LIVE";
  stages: MigrationStage[];
  goLiveBlockers: string[];
  signedOffBy: string | null;
  signedOffAt: string | null;
  /** The parallel run's sign-offs. */
  hrSignedOffBy: string | null;
  hrSignedOffAt: string | null;
  financeSignedOffBy: string | null;
  financeSignedOffAt: string | null;
}

/** One figure of the parallel run: the old system's, MyTrade's, and the difference (MyTrade − old). */
export interface RunFigure {
  oldSystem: number | null;
  myTrade: number | null;
  difference: number | null;
}

export interface ParallelRunLine {
  employeeId: number;
  employeeCode: string | null;
  employeeName: string | null;
  currency: string | null;
  gross: RunFigure;
  pf: RunFigure;
  esi: RunFigure;
  professionalTax: RunFigure;
  tds: RunFigure;
  net: RunFigure;
  flagged: boolean;
  reasons: string[];
}

export interface ParallelRunReport {
  month: string;
  employees: number;
  flagged: number;
  oldNet: number;
  myTradeNet: number;
  oldTds: number;
  myTradeTds: number;
  lines: ParallelRunLine[];
  months: string[];
}

export interface MigrationProblem {
  /** 0: the file as a whole. */
  row: number;
  column: string | null;
  message: string;
}

export type BatchStatus = "STAGED" | "COMMITTED" | "DISCARDED" | "UNDONE" | "REFUSED";

export interface MigrationBatch {
  /** Null when the file itself was refused: nothing was staged. */
  id: number | null;
  stage: string;
  type: string;
  title: string;
  fileName: string | null;
  status: BatchStatus;
  rows: number;
  problemCount: number;
  newCount: number;
  updatedCount: number;
  totals: Record<string, number>;
  problems: MigrationProblem[];
  committedBy: string | null;
  committedAt: string | null;
  undoneBy: string | null;
  undoneAt: string | null;
  /** The uploaded values were deleted (30 days after go-live, or after the batch was set aside). */
  rowsDeletedAt: string | null;
}

export interface MigrationRow {
  id: number;
  row: number;
  /** By column header. */
  values: Record<string, string | null>;
  problems: MigrationProblem[];
  result: "NEW" | "UPDATED" | null;
  entityId: number | null;
}

export type MatchHow = "PROFILE" | "READY" | "EXACT" | "SYNONYM" | "FUZZY" | "NONE";

export interface MappingView {
  type: string;
  sourceSystem: string | null;
  profileUsed: boolean;
  /** Each file header and the column it maps to (key null: none, or ignored by the saved mapping). */
  headers: { header: string; key: string | null; column: string | null; how: MatchHow }[];
  columns: MigrationColumn[];
  missingRequired: string[];
  problems: MigrationProblem[];
  /** The system whose ready-made mapping was used (Keka, greytHR...), when there is one. */
  readyProfile: string | null;
}

/** A value a staged batch was refused for, by column, to translate in the value dictionary. */
export interface UnmatchedValue {
  field: string;
  column: string;
  value: string;
  rows: number;
  /** The column's allowed values, when it has a list. */
  choices: string[];
}

/** A record a staged batch refers to that doesn't exist yet ("create these 4?"). */
export interface MissingRecord {
  /** The kind of record that would make it: "departments", "designations", "leave-types". */
  type: string;
  title: string;
  name: string;
  rows: number;
}

export interface DictionaryEntry {
  field: string;
  source: string;
  target: string;
  builtIn: boolean;
}

export interface GoLiveResult {
  status: "LIVE" | "IN_PROGRESS";
  loginsCreated: number;
  alreadyHadLogin: number;
  failures: { employeeId: number; employeeCode: string | null; message: string }[];
}

const file = (picked: File) => {
  const form = new FormData();
  form.append("file", picked);
  return form;
};

export const migrationApi = {
  project: () => axios.get<MigrationProject>(`${BASE}/project`).then((r) => r.data),
  saveProject: (goLiveDate: string | null, sourceSystem: string | null) =>
    axios.put<MigrationProject>(`${BASE}/project`, { goLiveDate, sourceSystem }).then((r) => r.data),
  workbook: () => axios.get<Blob>(`${BASE}/workbook`, { responseType: "blob" }).then((r) => r.data),
  uploadWorkbook: (picked: File) => axios.post<MigrationBatch[]>(`${BASE}/workbook`, file(picked)).then((r) => r.data),
  template: (type: string) => axios.get<Blob>(`${BASE}/${type}/template`, { responseType: "blob" }).then((r) => r.data),
  /** Stages rows typed or pasted into the grid (each row by column header); checked like an upload. */
  enter: (type: string, rows: Record<string, string>[]) =>
    axios.post<MigrationBatch>(`${BASE}/${type}/entries`, rows).then((r) => r.data),
  /** How the file's own headers map to the columns, before uploading it. */
  mapping: (type: string, picked: File) => axios.post<MappingView>(`${BASE}/${type}/mapping`, file(picked)).then((r) => r.data),
  /** {@code mapping}: file header → column key ("" ignores it); without it the headers are mapped automatically. */
  upload: (type: string, picked: File, mapping?: Record<string, string>, saveProfile = false) => {
    const form = file(picked);
    if (mapping) form.append("mapping", JSON.stringify(mapping));
    form.append("saveProfile", String(saveProfile));
    return axios.post<MigrationBatch>(`${BASE}/${type}/batches`, form).then((r) => r.data);
  },
  batches: () => axios.get<MigrationBatch[]>(`${BASE}/batches`).then((r) => r.data),
  batch: (id: number) => axios.get<MigrationBatch>(`${BASE}/batches/${id}`).then((r) => r.data),
  rows: (id: number, onlyProblems: boolean) =>
    axios.get<MigrationRow[]>(`${BASE}/batches/${id}/rows`, { params: { onlyProblems } }).then((r) => r.data),
  fixRow: (id: number, rowId: number, values: Record<string, string>) =>
    axios.put<MigrationBatch>(`${BASE}/batches/${id}/rows/${rowId}`, values).then((r) => r.data),
  unmatched: (id: number) => axios.get<UnmatchedValue[]>(`${BASE}/batches/${id}/unmatched-values`).then((r) => r.data),
  missing: (id: number) => axios.get<MissingRecord[]>(`${BASE}/batches/${id}/missing-records`).then((r) => r.data),
  /** Creates them as their own batches (undoable), then checks the batch again. */
  createMissing: (id: number, records: { type: string; name: string; values?: Record<string, string> }[]) =>
    axios.post<{ created: MigrationBatch[]; batch: MigrationBatch }>(`${BASE}/batches/${id}/create-missing`, records).then((r) => r.data),
  dictionary: () => axios.get<DictionaryEntry[]>(`${BASE}/dictionary`).then((r) => r.data),
  saveDictionary: (entries: { field: string; source: string; target: string }[]) =>
    axios.put<DictionaryEntry[]>(`${BASE}/dictionary`, entries).then((r) => r.data),
  check: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/check`).then((r) => r.data),
  commit: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/commit`).then((r) => r.data),
  discard: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/discard`).then((r) => r.data),
  undo: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/undo`).then((r) => r.data),
  parallelRunMonths: () => axios.get<string[]>(`${BASE}/parallel-run/months`).then((r) => r.data),
  /** MyTrade's dry run of the month against the old payroll register. */
  parallelRun: (month: string) => axios.get<ParallelRunReport>(`${BASE}/parallel-run`, { params: { month } }).then((r) => r.data),
  signOffParallelRun: (role: "HR" | "FINANCE") =>
    axios.post(`${BASE}/parallel-run/sign-off`, null, { params: { role } }).then((r) => r.data),
  goLive: () => axios.post<GoLiveResult>(`${BASE}/project/go-live`).then((r) => r.data),
};
