// Finance books (backlog 8.2.1.5): what each ledger source is called, and the cash boxes and bank accounts to pick from.
import { useEffect, useState } from "react";
import axios from "axios";
import { BANK_API, BankAccount } from "../../Invoice/bankShared";
import { t } from "../../../i18n/i18n";

export const BOOKS_API = "/v1/api/invoice/reports/books";

/** Where a journal entry came from (the ledger's source module), in plain words. */
export const SOURCE_LABELS: Record<string, string> = {
  SALES_INVOICE: "Sales invoice",
  PURCHASE_INVOICE: "Vendor bill",
  CREDIT_NOTE: "Credit note",
  DEBIT_NOTE: "Debit note",
  ADJUSTMENT_NOTE: "Adjustment",
  OTHER: "Journal entry",
  RECEIPT: "Customer receipt",
  CUSTOMER_CREDIT: "Customer credit used",
  VENDOR_PAYMENT: "Vendor payment",
  STOCK: "Stock",
  BANK: "Bank",
  FIXED_ASSET: "Fixed asset",
  OPENING_BALANCE: "Opening balance",
  PAYROLL: "Payroll",
  VENDOR_ADVANCE: "Vendor advance",
  EXPENSE_REVENUE: "Expense or income",
  FX_REVALUATION: "Exchange revaluation",
  YEAR_END_CLOSE: "Year-end close",
  CHEQUE: "Cheque",
  COMMISSION: "Sales commission",
  LETTER_OF_CREDIT: "Letter of credit",
  MARKETPLACE_SETTLEMENT: "Marketplace payout",
  POS_SHIFT: "Till shift",
};

export const sourceLabel = (module?: string | null) => (module ? t(SOURCE_LABELS[module] ?? module) : "—");

export const SOURCE_FILTER = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));

/** The company's cash boxes and bank accounts (Bank & Cash); empty when they can't be read. */
export const useBankAccounts = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  useEffect(() => {
    axios
      .get<BankAccount[]>(BANK_API, { skipSessionExpiredHandling: true } as object)
      .then((r) => setAccounts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAccounts([]));
  }, []);
  return accounts;
};
