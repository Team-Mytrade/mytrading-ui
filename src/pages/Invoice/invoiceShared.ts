// Shared by the Invoice (finance) pages. Values follow the invoice service's enums; labels are what users see.
import { formatEnumLabel } from "./invoiceEnums";
import { formatMoney, formatDate } from "../../company/format";

export { apiError, apiFieldErrors } from "../../utils/apiError";

export const INVOICE_API = "/v1/api/invoice";
export const CUSTOMER_FINANCIAL_API = "/v1/api/customer-financial";

export type Option = { id: string; name: string };

/* ================= Formatting ================= */

// Finance amounts keep the currency's decimals; dashboards round, ledgers don't
export const money = (value: number | string | null | undefined, currency?: string | null): string =>
  formatMoney(value, { currency });

export const dateLabel = (value?: string | null): string => formatDate(value);

export const todayInput = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// Days past the due date (0 when not due yet)
export const daysOverdue = (dueDate?: string | null): number => {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const days = Math.floor((Date.now() - due) / 86_400_000);
  return days > 0 ? days : 0;
};

export const labelOf = (code?: string | null): string => (code ? formatEnumLabel(code) : "—");

// Report month keys: "2026-10" → "Oct 2026"
export const monthLabel = (key: string): string => {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

/* ================= Sales invoices ================= */

export interface InvoiceLine {
  id: number;
  productId?: number;
  productCode?: string;
  productName?: string;
  description?: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
  grossAmount?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxCode?: string;
  taxRate?: number;
  taxAmount?: number;
  lineTotal?: number;
  batchNumber?: string;
  serialNumbers?: string[];
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  status: string;
  salesOrderId?: number;
  salesOrderNumber?: string;
  salesDispatchId?: number;
  salesDispatchNumber?: string;
  customerId?: number;
  customerCode?: string;
  customerName?: string;
  customerTaxNumber?: string;
  customerEmail?: string;
  currencyCode?: string;
  // Company currency per unit of the invoice's, fixed when issued
  exchangeRate?: number | null;
  paymentTerms?: string;
  customerReference?: string;
  subTotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  grandTotal?: number;
  amountPaid?: number;
  balanceAmount?: number;
  remarks?: string;
  items?: InvoiceLine[];
  issuedAt?: string;
  issuedBy?: string;
  // Payment reminders emailed to the customer (automatic or by hand)
  overdueRemindersSent?: number | null;
  lastReminderOn?: string | null;
  lastReminderType?: "BEFORE_DUE" | "OVERDUE" | null;
}

export const INVOICE_STATUS_TONES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ISSUED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200 line-through",
  VOID: "bg-gray-100 text-gray-500 border-gray-200 line-through",
};

// Payments, credit notes and credits only apply to issued invoices that still have something open
export const isOpenInvoice = (status?: string) => status === "ISSUED" || status === "PARTIALLY_PAID" || status === "OVERDUE";

/* ================= Receivables ================= */

export const AR_STATUS_TONES: Record<string, string> = {
  OPEN: "bg-cyan-50 text-cyan-700 border-cyan-200",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
};

/* ================= Payments ================= */

// Stored as free text by the service; these are the methods the screens offer
export const PAYMENT_METHOD_OPTIONS: Option[] = [
  { id: "BANK_TRANSFER", name: "Bank transfer" },
  { id: "UPI", name: "UPI" },
  { id: "CHEQUE", name: "Cheque" },
  { id: "CASH", name: "Cash" },
  { id: "CARD", name: "Card" },
  { id: "OTHER", name: "Other" },
];

export const paymentMethodLabel = (method?: string | null) =>
  PAYMENT_METHOD_OPTIONS.find((option) => option.id === method)?.name ?? labelOf(method);

export const CREDIT_NOTE_TYPE_OPTIONS: Option[] = [
  { id: "SALES_RETURN", name: "Sales return" },
  { id: "PRICE_ADJUSTMENT", name: "Price adjustment" },
  { id: "DISCOUNT", name: "Discount" },
  { id: "BILLING_CORRECTION", name: "Billing correction" },
  { id: "TAX_ADJUSTMENT", name: "Tax adjustment" },
  { id: "OTHER", name: "Other" },
];

/* ================= Ledger ================= */

export interface GeneralAccount {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  isActive?: boolean;
  allowTransactions?: boolean;
  description?: string;
  currency?: string;
  openingBalance?: number;
}

export interface JournalLine {
  id?: number;
  generalAccountId?: number;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
  // The line in the entry's (document's) currency, debit positive
  currencyAmount?: number | null;
}

export interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate?: string;
  description?: string;
  sourceModule?: string;
  sourceId?: number;
  entries: JournalLine[];
  // Posted by the system from a document: read-only (the document is corrected instead)
  automatic?: boolean;
  postingKey?: string | null;
  // The entry this one reverses (cancelled invoice, reversed receipt, corrected bill)
  reversalOf?: number | null;
  // The document's currency and rate (amounts are in the company's currency)
  currency?: string | null;
  exchangeRate?: number | null;
}

export const ACCOUNT_TYPE_OPTIONS: Option[] = [
  { id: "ASSET", name: "Asset" },
  { id: "LIABILITY", name: "Liability" },
  { id: "EQUITY", name: "Equity" },
  { id: "INCOME", name: "Income" },
  { id: "EXPENSE", name: "Expense" },
  { id: "OTHER", name: "Other" },
];

export const SOURCE_MODULE_OPTIONS: Option[] = [
  { id: "SALES_INVOICE", name: "Sales invoice" },
  { id: "PURCHASE_INVOICE", name: "Purchase invoice" },
  { id: "CREDIT_NOTE", name: "Credit note" },
  { id: "DEBIT_NOTE", name: "Debit note" },
  { id: "ADJUSTMENT_NOTE", name: "Adjustment" },
  { id: "OTHER", name: "Other" },
];

// Sources only automatic postings have (not offered for entries made by hand)
export const AUTOMATIC_SOURCE_OPTIONS: Option[] = [
  { id: "RECEIPT", name: "Customer receipt" },
  { id: "CUSTOMER_CREDIT", name: "Customer credit used" },
  { id: "VENDOR_PAYMENT", name: "Vendor payment" },
  { id: "STOCK", name: "Stock" },
  { id: "BANK", name: "Bank" },
];

// Assets and expenses grow with debits; liabilities, equity and income with credits
export const isDebitNormal = (accountType?: string) => accountType !== "LIABILITY" && accountType !== "EQUITY" && accountType !== "INCOME";

// Older servers send only the account code on journal lines
export const lineIsFor = (line: JournalLine, account: GeneralAccount) =>
  line.generalAccountId != null ? line.generalAccountId === account.id : line.accountCode === account.accountCode;

export const accountLabel = (account?: Pick<GeneralAccount, "accountCode" | "accountName"> | null) =>
  account ? `${account.accountCode} · ${account.accountName}` : "—";

/* ================= Files ================= */

export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
