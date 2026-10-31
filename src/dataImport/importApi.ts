// Settings → Data Import: Excel templates and imports. Each service that holds importable records serves the same
// endpoints under its own base (products, customers and vendors are in common-service).
import axios from "axios";

/** Services with imports, in go-live order: master data, opening stock, then open invoices, bills and ledger balances. */
const SOURCES = ["/v1/api/common/import", "/v1/api/inventory/import", "/v1/api/invoice/import"];

export interface ImportColumn {
  header: string;
  required: boolean;
  example: string | null;
  note: string | null;
  choices: string[];
}

export interface ImportType {
  type: string;
  title: string;
  description: string;
  allowed: boolean;
  permission: string;
  columns: ImportColumn[];
  /** The service base it came from. */
  base: string;
}

export interface ImportProblem {
  /** 0: the file as a whole. */
  row: number;
  column: string | null;
  message: string;
}

export interface ImportResult {
  type: string;
  fileName: string;
  rows: number;
  imported: boolean;
  problemCount: number;
  problems: ImportProblem[];
  preview: Record<string, string | null>[];
}

export interface ImportRun {
  id: number;
  type: string;
  title: string;
  fileName: string | null;
  rows: number;
  importedBy: string | null;
  importedAt: string;
}

const upload = (base: string, type: string, action: "check" | "run", file: File) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post<ImportResult>(`${base}/${type}/${action}`, form).then((r) => r.data);
};

export const importApi = {
  /** Every import from every source; a source that is down is left out. */
  types: async (): Promise<ImportType[]> => {
    const lists = await Promise.all(SOURCES.map((base) =>
      axios.get<Omit<ImportType, "base">[]>(`${base}/types`)
        .then((r) => r.data.map((t) => ({ ...t, base })))
        .catch(() => [] as ImportType[])));
    return lists.flat();
  },
  template: (t: ImportType) =>
    axios.get<Blob>(`${t.base}/${t.type}/template`, { responseType: "blob" }).then((r) => r.data),
  check: (t: ImportType, file: File) => upload(t.base, t.type, "check", file),
  run: (t: ImportType, file: File) => upload(t.base, t.type, "run", file),
  history: async (): Promise<ImportRun[]> => {
    const lists = await Promise.all(SOURCES.map((base) =>
      axios.get<ImportRun[]>(`${base}/history`).then((r) => r.data).catch(() => [] as ImportRun[])));
    return lists.flat().sort((a, b) => (b.importedAt ?? "").localeCompare(a.importedAt ?? ""));
  },
};
