import axios from "axios";
import { BookOpen, Boxes, Package, Store, Users, type LucideIcon } from "lucide-react";
import { hasModule, hasPermission, type AccessInfo } from "../access/access";
import type { CompanyProfile } from "./companyApi";

/**
 * The go-live check (backlog ADO-2 / 9.0.7): before a company starts working in the system, the opening data it
 * brought in is checked for what would print wrongly, break margins, stock or e-invoices, or split one customer in two.
 * Three services each count their own part (common: products, customers, vendors; inventory: stock; invoice: the
 * books) with the person's own rights; this file words each check, weighs it and says where to fix it.
 */
export type Source = "common" | "inventory" | "invoice";
export type Area = "Products" | "Customers" | "Vendors" | "Stock" | "Books";
// must: wrong documents, stock or books until fixed; should: worth a look, may be right for this company
export type Weight = "must" | "should";
export type CheckStatus = "pass" | "must" | "should" | "unavailable" | "notNeeded";

export interface Sample { id: number | null; code: string | null; name: string | null; kind: string | null; detail: string | null; value: number | null }
interface ServerCheck { code: string; allowed: boolean; count: number; total: number; samples: Sample[] }
export interface ServerReport { checkedAt: string; checks: ServerCheck[]; figures: Record<string, number> }

const URLS: Record<Source, string> = {
  common: "/v1/api/common/data-checks",
  inventory: "/v1/api/inventory/data-checks",
  invoice: "/v1/api/invoice/data-checks",
};

// The module a service's part belongs to; common answers for products (and vendors) and for customers
const SOURCE_MODULES: Record<Source, string[]> = { common: ["PRODUCT_CATALOGUE", "CRM"], inventory: ["INVENTORY"], invoice: ["INVOICE"] };

export interface CheckDefinition {
  code: string;
  source: Source;
  area: Area;
  // The module and right needed to see the records
  module: string;
  permission: string;
  weight: Weight;
  title: string;
  why: string;
  fix: string;
  route: string;
  // Only for companies registered for VAT / GST
  taxOnly?: boolean;
}

export const AREAS: { area: Area; icon: LucideIcon }[] = [
  { area: "Products", icon: Package },
  { area: "Customers", icon: Users },
  { area: "Vendors", icon: Store },
  { area: "Stock", icon: Boxes },
  { area: "Books", icon: BookOpen },
];

const PRODUCTS = { source: "common", area: "Products", module: "PRODUCT_CATALOGUE", permission: "PRODUCT_CATALOGUE:VIEW", route: "/common/products", fix: "Open Products" } as const;
const CUSTOMERS = { source: "common", area: "Customers", module: "CRM", permission: "CRM:VIEW", route: "/customer-management", fix: "Open Customers" } as const;
const VENDORS = { source: "common", area: "Vendors", module: "PRODUCT_CATALOGUE", permission: "PRODUCT_CATALOGUE:VIEW", route: "/common/vendors", fix: "Open Vendors" } as const;
const STOCK = { source: "inventory", area: "Stock", module: "INVENTORY", permission: "INVENTORY:VIEW" } as const;
const BOOKS = { source: "invoice", area: "Books", module: "INVOICE", permission: "INVOICE:VIEW" } as const;

export const STOCK_LEDGER_MISMATCH = "STOCK_LEDGER_MISMATCH";

export const CHECKS: CheckDefinition[] = [
  { ...PRODUCTS, code: "PRODUCTS_WITHOUT_TAX_CODE", weight: "must", taxOnly: true, title: "Products without a tax code",
    why: "The VAT or GST rate on every invoice line comes from the product's tax code; without one the line can carry the wrong tax and an e-invoice can be refused." },
  { ...PRODUCTS, code: "PRODUCTS_WITHOUT_COST", weight: "should", title: "Stock items without a standard cost",
    why: "Opening stock imported without a unit cost takes the standard cost; with neither it comes in at zero and every sale shows full margin." },
  { ...PRODUCTS, code: "PRODUCTS_WITHOUT_PRICE", weight: "should", title: "Products without a selling price",
    why: "Quotations, orders and the till start from the selling price; without one each line is priced by hand unless a price list covers it." },
  { ...PRODUCTS, code: "DUPLICATE_PRODUCTS", weight: "should", title: "Products entered twice",
    why: "The same name or barcode on two products splits their stock, sales and reorder figures in two." },
  { ...CUSTOMERS, code: "CUSTOMERS_WITHOUT_TAX_NUMBER", weight: "should", taxOnly: true, title: "Business customers without a tax number",
    why: "A customer registered for VAT or GST needs its TRN, VAT number or GSTIN on tax invoices and e-invoices. Retail customers are left out." },
  { ...CUSTOMERS, code: "CUSTOMERS_WITHOUT_ADDRESS", weight: "should", title: "Customers without an address",
    why: "Tax invoices to businesses print the buyer's address, and deliveries need one." },
  { ...CUSTOMERS, code: "CUSTOMERS_WITHOUT_CREDIT_LIMIT", weight: "should", title: "Credit customers without a credit limit",
    why: "A blank limit means no limit: their orders are never held, however much they owe. Set a limit (0 for advance payment only) or mark them as cash customers." },
  { ...CUSTOMERS, code: "DUPLICATE_CUSTOMERS", weight: "should", title: "Customers entered twice",
    why: "The same tax number, name, phone or e-mail on two customers splits their balance, credit limit and history in two." },
  { ...VENDORS, code: "VENDORS_WITHOUT_TAX_NUMBER", weight: "should", taxOnly: true, title: "Vendors without a tax number",
    why: "Input tax on a registered vendor's bills is claimed with its tax number." },
  { ...VENDORS, code: "DUPLICATE_VENDORS", weight: "should", title: "Vendors entered twice",
    why: "The same tax number, name, phone or e-mail on two vendors splits what you owe them and their purchase history." },
  { ...STOCK, code: "STOCK_WITHOUT_COST", weight: "must", title: "Stock on hand without a cost", route: "/stock-level", fix: "Open Stock Levels",
    why: "Stock with no cost is worth nothing in the books and its sales show full margin. Give it its cost with a stock adjustment, or import it again with the unit cost." },
  { ...STOCK, code: "NEGATIVE_STOCK", weight: "must", title: "Stock below zero", route: "/stock-level", fix: "Open Stock Levels",
    why: "More was sold or issued than was received. Count it and correct it, or receive what is missing, before the first sale." },
  { ...STOCK, code: "EXPIRED_STOCK", weight: "should", title: "Expired batches still in stock", route: "/batch", fix: "Open Batches",
    why: "Expired batches can't be sold or issued. Write them off with a stock adjustment, or return them to the vendor." },
  { ...STOCK, code: "STOCK_NOT_IN_BOOKS", weight: "must", title: "Stock movements not yet in the books", route: "/stock-movement", fix: "Open Stock Movements",
    why: "These movements have a cost but the ledger hasn't taken them for more than 30 minutes. They are sent again every few minutes; if they stay, finance is not reachable or refuses them (a closed period, for example)." },
  { ...STOCK, source: "invoice", code: STOCK_LEDGER_MISMATCH, weight: "should", title: "Stock value differs from the stock account",
    route: "/financialStatements", fix: "Open Financial Statements", module: "INVENTORY", permission: "INVENTORY:VIEW",
    why: "The stock on hand at its average cost should equal the inventory account in the ledger. A difference comes from journals typed to the stock account, movements not yet in the books, or stock posted at another cost." },
  { ...BOOKS, code: "LEDGER_NOT_BALANCED", weight: "must", title: "The ledger doesn't balance", route: "/generalAccounts", fix: "Open Chart of Accounts",
    why: "Journals always balance, so the difference comes from opening balances typed on the accounts below. Bring opening balances in with Data Import (Ledger balances) instead, and clear the typed ones." },
  { ...BOOKS, code: "OPENING_BALANCE_LEFT", weight: "should", title: "Opening balance equity is not empty", route: "/journalEntries", fix: "Open Journal Entries",
    why: "Every imported opening balance (stock, unpaid invoices and bills, ledger balances) is posted against opening balance equity. Once the whole old trial balance is in, move what is left to capital or retained earnings with a journal; an amount that doesn't match the old books means an opening balance is missing or entered twice." },
  { ...BOOKS, code: "RECEIVABLES_MISMATCH", weight: "must", title: "Receivables account differs from the unpaid invoices", route: "/accountsReceivable", fix: "Open Accounts Receivable",
    why: "The receivables account should equal what customers still owe on their invoices. A difference comes from journals typed straight to the receivables account; customer balances and dunning use the invoices." },
  { ...BOOKS, code: "PAYABLES_MISMATCH", weight: "must", title: "Payables account differs from the unpaid bills", route: "/accountsPayable", fix: "Open Accounts Payable",
    why: "The payables account should equal what is still owed on vendor bills. A difference comes from journals typed straight to the payables account." },
];

export interface CheckResult {
  definition: CheckDefinition;
  status: CheckStatus;
  count: number;
  total: number;
  samples: Sample[];
  // For the comparisons: the two figures and their difference
  compare?: { left: number; right: number; difference: number; leftLabel: string; rightLabel: string };
  // For a check on the whole ledger (not on records): the amount found
  amount?: { label: string; value: number };
  // Why it wasn't checked
  reason?: string;
}

export interface GoLiveReport {
  results: CheckResult[];
  checkedAt: string | null;
  must: number;
  should: number;
  passed: number;
  checked: number;
}

const taxed = (company: CompanyProfile | null | undefined) => !company?.taxRegime || company.taxRegime === "VAT" || company.taxRegime === "GST";

// As the services allow: 1 unit, or 0.1 % of the larger figure (each document rounded at its own rate)
const differs = (a: number, b: number) => Math.abs(a - b) > Math.max(1, Math.max(Math.abs(a), Math.abs(b)) * 0.001);

/** Asks each service the person may use, then words every check: passed, must fix, should look at, or not checked. */
export const runGoLiveCheck = async (access: AccessInfo, company: CompanyProfile | null | undefined): Promise<GoLiveReport> => {
  const asked = (Object.keys(URLS) as Source[]).filter((s) => SOURCE_MODULES[s].some((m) => hasModule(access, m)));
  const answers = await Promise.all(asked.map(async (source) => {
    try {
      return [source, (await axios.get<ServerReport>(URLS[source])).data] as const;
    } catch {
      return [source, null] as const;
    }
  }));
  const reports = Object.fromEntries(answers) as Partial<Record<Source, ServerReport | null>>;

  const results = CHECKS.map((definition): CheckResult => {
    const base = { definition, count: 0, total: 0, samples: [] as Sample[] };
    if (definition.taxOnly && !taxed(company)) return { ...base, status: "notNeeded", reason: "Your company isn't registered for VAT or GST" };
    if (!hasModule(access, definition.module)) return { ...base, status: "unavailable", reason: "Not in your company's plan" };
    if (!hasPermission(access, definition.permission)) return { ...base, status: "unavailable", reason: "You can't see these records" };

    if (definition.code === STOCK_LEDGER_MISMATCH) {
      if (!hasModule(access, "INVOICE")) return { ...base, status: "notNeeded", reason: "No finance module: stock isn't in a ledger here" };
      const stock = reports.inventory?.figures?.stockValue;
      const account = reports.invoice?.figures?.stockAccount;
      if (stock == null || account == null) {
        return { ...base, status: "unavailable", reason: hasPermission(access, "INVOICE:VIEW") ? "Couldn't check" : "You can't see the books" };
      }
      const compare = { left: stock, right: account, difference: account - stock, leftLabel: "Stock value", rightLabel: "Stock account" };
      return { ...base, total: 1, count: differs(stock, account) ? 1 : 0, status: differs(stock, account) ? definition.weight : "pass", compare };
    }

    const report = reports[definition.source];
    const found = report?.checks?.find((c) => c.code === definition.code);
    if (!report || !found) return { ...base, status: "unavailable", reason: "Couldn't check" };
    if (!found.allowed) return { ...base, status: "unavailable", reason: "You can't see these records" };
    const result: CheckResult = { ...base, count: found.count, total: found.total, samples: found.samples ?? [],
      status: found.count > 0 ? definition.weight : "pass" };
    const figures = report.figures ?? {};
    if (definition.code === "LEDGER_NOT_BALANCED" && figures.ledgerDifference != null) {
      result.amount = { label: "Debits less credits", value: figures.ledgerDifference };
    }
    if (definition.code === "OPENING_BALANCE_LEFT" && figures.openingBalance != null) {
      result.amount = { label: "Left in opening balance equity", value: figures.openingBalance };
    }
    if (definition.code === "RECEIVABLES_MISMATCH" && figures.receivablesLedger != null) {
      result.compare = { left: figures.receivablesLedger, right: figures.receivablesOpen, difference: figures.receivablesLedger - figures.receivablesOpen,
        leftLabel: "Receivables account", rightLabel: "Unpaid invoices" };
    }
    if (definition.code === "PAYABLES_MISMATCH" && figures.payablesLedger != null) {
      result.compare = { left: figures.payablesLedger, right: figures.payablesOpen, difference: figures.payablesLedger - figures.payablesOpen,
        leftLabel: "Payables account", rightLabel: "Unpaid bills" };
    }
    return result;
  });

  const checked = results.filter((r) => ["pass", "must", "should"].includes(r.status));
  const times = Object.values(reports).map((r) => r?.checkedAt).filter((v): v is string => !!v).sort();
  return {
    results,
    checkedAt: times.length ? times[times.length - 1] : null,
    must: results.filter((r) => r.status === "must").length,
    should: results.filter((r) => r.status === "should").length,
    passed: results.filter((r) => r.status === "pass").length,
    checked: checked.length,
  };
};
