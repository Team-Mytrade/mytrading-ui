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
  upload: (type: string, picked: File) => axios.post<MigrationBatch>(`${BASE}/${type}/batches`, file(picked)).then((r) => r.data),
  batches: () => axios.get<MigrationBatch[]>(`${BASE}/batches`).then((r) => r.data),
  batch: (id: number) => axios.get<MigrationBatch>(`${BASE}/batches/${id}`).then((r) => r.data),
  rows: (id: number, onlyProblems: boolean) =>
    axios.get<MigrationRow[]>(`${BASE}/batches/${id}/rows`, { params: { onlyProblems } }).then((r) => r.data),
  fixRow: (id: number, rowId: number, values: Record<string, string>) =>
    axios.put<MigrationBatch>(`${BASE}/batches/${id}/rows/${rowId}`, values).then((r) => r.data),
  check: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/check`).then((r) => r.data),
  commit: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/commit`).then((r) => r.data),
  discard: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/discard`).then((r) => r.data),
  undo: (id: number) => axios.post<MigrationBatch>(`${BASE}/batches/${id}/undo`).then((r) => r.data),
  goLive: () => axios.post<GoLiveResult>(`${BASE}/project/go-live`).then((r) => r.data),
};
