// Bank accounts and cash boxes (invoice service /bank-accounts): types, defaults for receipts and payments
// (the picker is BankAccountField), and reading bank statement files for reconciliation.
import { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { INVOICE_API } from "./invoiceShared";

export const BANK_API = `${INVOICE_API}/bank-accounts`;

export type BankAccountKind = "BANK" | "CASH";

export interface BankAccount {
  id: number;
  accountName: string;
  kind: BankAccountKind;
  bankName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  currency?: string | null;
  generalAccountId: number;
  generalAccountCode: string;
  generalAccountName: string;
  openingDate: string;
  openingBalance?: number | null;
  active: boolean;
  defaultAccount: boolean;
  bookBalance: number;
}

export interface BookLine {
  id: number;
  journalEntryId: number;
  entryNumber: string;
  date: string;
  description?: string | null;
  narration?: string | null;
  amount: number;
  sourceModule?: string | null;
  automatic: boolean;
}

export interface StatementLine {
  id: number;
  date: string;
  description?: string | null;
  reference?: string | null;
  amount: number;
  balance?: number | null;
  importBatch?: string | null;
  matched: boolean;
  posted: boolean;
  matches: BookLine[];
}

export interface Reconciliation {
  account: BankAccount;
  asOf: string;
  bookBalance: number;
  unclearedBook: number;
  unrecordedStatement: number;
  expectedStatementBalance: number;
  statementBalance?: number | null;
  statementBalanceDate?: string | null;
  difference?: number | null;
  statementLines: StatementLine[];
  unmatchedBookLines: BookLine[];
}

export const bankAccountName = (accounts: BankAccount[] | null, id?: number | null) => {
  const account = id != null ? accounts?.find((a) => a.id === id) : undefined;
  return account ? bankAccountLabel(account) : null;
};

// "Emirates NBD current · ••5678"
export const bankAccountLabel = (account: Pick<BankAccount, "accountName" | "accountNumber" | "kind">) =>
  account.kind === "BANK" && account.accountNumber
    ? `${account.accountName} · ••${account.accountNumber.slice(-4)}`
    : account.accountName;

// Same rule as the service: methods with "CASH" in them are cash, the rest go through a bank
export const kindForMethod = (method?: string | null): BankAccountKind =>
  method && method.toUpperCase().includes("CASH") ? "CASH" : "BANK";

export const defaultBankAccountId = (accounts: BankAccount[], method?: string | null): string => {
  const kind = kindForMethod(method);
  const pick = accounts.find((a) => a.active && a.kind === kind && a.defaultAccount) ?? accounts.find((a) => a.active && a.kind === kind);
  return pick ? String(pick.id) : "";
};

/** The company's bank accounts and cash boxes; null while loading, [] when none are set up (or can't be read). */
export const useBankAccounts = (): BankAccount[] | null => {
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  useEffect(() => {
    let alive = true;
    axios
      .get<BankAccount[]>(BANK_API)
      .then((res) => alive && setAccounts(Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setAccounts([]));
    return () => {
      alive = false;
    };
  }, []);
  return accounts;
};

/* ================= Statement files ================= */

export type DateOrder = "DMY" | "MDY" | "YMD";

export interface StatementColumns {
  date: number;
  description: number;
  reference: number;
  // Either one signed amount column, or money out and money in columns
  amount: number;
  moneyOut: number;
  moneyIn: number;
  balance: number;
}

export interface ParsedStatementLine {
  date: string | null;
  description: string | null;
  reference: string | null;
  amount: number | null;
  balance: number | null;
}

/** The first sheet of a CSV or Excel file as rows of cells (text as written, Excel dates as dates). */
export const readStatementFile = async (file: File): Promise<unknown[][]> => {
  const data = await file.arrayBuffer();
  const text = /\.(csv|txt)$/i.test(file.name);
  // CSV is read as text so "05/10/2026" isn't turned into a US date
  const book = text
    ? XLSX.read(new TextDecoder().decode(data), { type: "string", raw: true })
    : XLSX.read(data, { type: "array", cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
};

/** The header row: the first with a "date" cell and at least three filled cells (banks put account details above). */
export const findHeaderRow = (rows: unknown[][]): number => {
  const index = rows.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 3
    && row.some((cell) => /date/i.test(String(cell ?? ""))));
  return index >= 0 ? index : 0;
};

/** Columns guessed from the header names; -1 where none fits. */
export const guessColumns = (header: unknown[]): StatementColumns => {
  const names = header.map((cell) => String(cell ?? "").trim().toLowerCase());
  const find = (pattern: RegExp, except?: RegExp) => names.findIndex((name) => pattern.test(name) && !(except && except.test(name)));
  const date = (() => {
    const txn = find(/(transaction|txn|posting|tran)\s*date/);
    return txn >= 0 ? txn : find(/date/, /value/);
  })();
  return {
    date: date >= 0 ? date : find(/date/),
    description: find(/desc|narration|particular|details|remark|memo/),
    reference: find(/ref|cheque|chq|instrument/),
    amount: find(/^(amount|amt|transaction amount)( \(.*\))?$/),
    moneyOut: find(/debit|withdraw|money out|paid out|payments?\b|^dr\b/),
    moneyIn: find(/credit|deposit|money in|paid in|receipts?\b|^cr\b/),
    balance: find(/balance/),
  };
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** A statement date as yyyy-mm-dd: Excel dates, ISO text, or day/month/year in the order given ("28-Oct-2026" too). */
export const parseStatementDate = (value: unknown, order: DateOrder): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  const text = String(value ?? "").trim().split(/[ T]\d{1,2}:\d{2}/)[0];
  if (!text) return null;
  const parts = text.split(/[/\-.\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const named = parts.findIndex((p) => MONTHS.includes(p.slice(0, 3).toLowerCase()) && /^[a-z]/i.test(p));
  let y: number, m: number, d: number;
  if (named >= 0) {
    m = MONTHS.indexOf(parts[named].slice(0, 3).toLowerCase()) + 1;
    const rest = parts.filter((_, i) => i !== named).map(Number);
    [d, y] = rest[0] > 31 ? [rest[1], rest[0]] : [rest[0], rest[1]];
  } else {
    const nums = parts.slice(0, 3).map(Number);
    if (nums.some(Number.isNaN)) return null;
    if (order === "YMD" || nums[0] > 31) [y, m, d] = nums;
    else if (order === "MDY") [m, d, y] = nums;
    else [d, m, y] = nums;
  }
  if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900)) return null;
  const check = new Date(y, m - 1, d);
  return check.getMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/** An amount as the bank wrote it: "1,234.50", "(25.00)", "25.00-", "1.234,50", "250.00 DR". */
export const parseStatementAmount = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
  if (/\bdr\.?$/i.test(text)) { negative = true; text = text.replace(/\bdr\.?$/i, ""); }
  text = text.replace(/\bcr\.?$/i, "");
  if (/-\s*$/.test(text)) { negative = true; text = text.replace(/-\s*$/, ""); }
  if (/^\s*-/.test(text)) { negative = !negative; text = text.replace(/^\s*-/, ""); }
  text = text.replace(/[^\d.,]/g, "");
  if (!text) return null;
  // Comma as the decimal mark when it comes last with 1–2 digits after it
  if (/,\d{1,2}$/.test(text) && (text.includes(".") || !/,\d{3}/.test(text))) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
};

/** The data rows under the header as statement lines (money in positive); blank rows are dropped. */
export const toStatementLines = (rows: unknown[][], headerRow: number, columns: StatementColumns, order: DateOrder): ParsedStatementLine[] => {
  const cell = (row: unknown[], index: number) => (index >= 0 ? row[index] : undefined);
  const text = (row: unknown[], index: number) => {
    const value = String(cell(row, index) ?? "").trim();
    return value || null;
  };
  return rows
    .slice(headerRow + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((row) => {
      let amount: number | null;
      if (columns.amount >= 0) {
        amount = parseStatementAmount(cell(row, columns.amount));
      } else {
        const out = parseStatementAmount(cell(row, columns.moneyOut));
        const into = parseStatementAmount(cell(row, columns.moneyIn));
        amount = out == null && into == null ? null : (into ?? 0) - Math.abs(out ?? 0);
      }
      return {
        date: parseStatementDate(cell(row, columns.date), order),
        description: text(row, columns.description),
        reference: text(row, columns.reference),
        amount,
        balance: parseStatementAmount(cell(row, columns.balance)),
      };
    });
};
