import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { CUSTOMER_FINANCIAL_API, apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import {
  ExportButtons,
  FilterBar,
  Period,
  PeriodPicker,
  ReportColumn,
  ReportWarnings,
  SelectField,
  TotalCard,
  initialPeriod,
  num,
  useSalesFilterOptions,
  useSyncedParams,
  useVendorOptions,
} from "./reportKit";
import { BOOKS_API } from "./booksShared";
import { t } from "../../../i18n/i18n";

/** One line of a customer's or vendor's ledger, whichever service it came from. */
interface LedgerLine {
  date: string;
  type: string;
  number?: string | null;
  reference?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
  balance: number;
  affectsBalance: boolean;
}

interface Ledger {
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  currencies: string[];
  warnings: string[];
  rows: LedgerLine[];
}

type Row = LedgerLine & { id: string };
type Party = "customer" | "vendor";

const MODULES = ["INVOICE"];
const TYPES: Record<string, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  PAYMENT_REVERSAL: "Payment reversed",
  CREDIT_NOTE: "Credit note",
  CREDIT_APPLICATION: "Credit used",
  INVOICE_CANCELLATION: "Invoice cancelled",
  BILL: "Bill",
  DEBIT_NOTE: "Debit note",
  ADVANCE: "Advance paid",
  ADVANCE_APPLIED: "Advance used on a bill",
  PAYMENT_CANCELLED: "Cheque cancelled",
};

interface CustomerStatement {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  entries: { transactionDate: string; type: string; documentNumber?: string; referenceNumber?: string; description?: string; debit: number; credit: number; affectsBalance: boolean }[];
}

interface VendorLedgerResponse {
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  currencies: string[];
  warnings: string[];
  rows: { date: string; type: string; number?: string; reference?: string; description?: string; debit: number; credit: number; balance: number; affectsBalance: boolean }[];
}

/** A customer's statement (what they owe: debit − credit), with its running balance. */
const fromCustomer = (s: CustomerStatement): Ledger => {
  let balance = num(s.openingBalance);
  return {
    opening: num(s.openingBalance),
    debit: num(s.totalDebit),
    credit: num(s.totalCredit),
    closing: num(s.closingBalance),
    currencies: [],
    warnings: [],
    rows: (s.entries ?? []).map((e) => {
      if (e.affectsBalance) balance += num(e.debit) - num(e.credit);
      return { date: e.transactionDate, type: e.type, number: e.documentNumber, reference: e.referenceNumber, description: e.description, debit: num(e.debit), credit: num(e.credit), balance, affectsBalance: e.affectsBalance };
    }),
  };
};

/**
 * A customer's or vendor's ledger for a period (backlog 8.2.1.5): opening balance, every document and payment, and the
 * balance after each, in the documents' own currency. Customers come from their statement; vendors from bills, debit
 * notes, payments and advances.
 */
const PartyLedger: React.FC<{ party: Party }> = ({ party }) => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "this-year"));
  const [partyId, setPartyId] = useState(params.get(party === "customer" ? "customerId" : "vendorId") ?? "");
  const [report, setReport] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers } = useSalesFilterOptions();
  const vendors = useVendorOptions();
  const options = party === "customer" ? customers : vendors;
  const title = party === "customer" ? "Customer Ledger" : "Vendor Ledger";

  const load = useCallback(async () => {
    if (!partyId) {
      setReport(null);
      return;
    }
    try {
      setLoading(true);
      const quiet = { skipSessionExpiredHandling: true };
      if (party === "customer") {
        const res = await axios.get<CustomerStatement>(`${CUSTOMER_FINANCIAL_API}/${partyId}/statement`, {
          params: { fromDate: period.from, toDate: period.to },
          ...quiet,
        } as object);
        setReport(res.data && Array.isArray(res.data.entries) ? fromCustomer(res.data) : null);
      } else {
        const res = await axios.get<VendorLedgerResponse>(`${BOOKS_API}/vendor-ledger`, { params: { vendorId: partyId, from: period.from, to: period.to }, ...quiet } as object);
        setReport(res.data && Array.isArray(res.data.rows) ? (res.data as Ledger) : null);
      }
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the ledger"));
    } finally {
      setLoading(false);
    }
  }, [party, partyId, period.from, period.to]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, [party === "customer" ? "customerId" : "vendorId"]: partyId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r, i) => ({ ...r, id: `${r.type}-${r.number ?? ""}-${i}` })), [report]);
  const typeLabel = (r: LedgerLine) => t(TYPES[r.type] ?? r.type);
  // A customer owes what is debited; the company owes a vendor what is credited
  const owedLabel = party === "customer" ? "Customer owes" : "You owe";

  const columns: ColumnDef<Row>[] = [
    { key: "date", label: "Date", render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    {
      key: "number",
      label: "Document",
      render: (r) => (
        <span className={`text-sm ${r.affectsBalance ? "" : "text-slate-400"}`}>
          <span className="font-semibold">{r.number ?? "—"}</span>
          <span className="block text-xs">{[typeLabel(r), r.reference].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    { key: "description", label: "Description", render: (r) => <span className="text-sm text-slate-600">{r.description ?? ""}</span> },
    { key: "debit", label: "Debit", headerClassName: "text-right", className: "text-right", render: (r) => <span className={`text-sm ${r.affectsBalance ? "text-slate-800" : "text-slate-400"}`}>{num(r.debit) === 0 ? "" : money(r.debit)}</span> },
    { key: "credit", label: "Credit", headerClassName: "text-right", className: "text-right", render: (r) => <span className={`text-sm ${r.affectsBalance ? "text-slate-800" : "text-slate-400"}`}>{num(r.credit) === 0 ? "" : money(r.credit)}</span> },
    { key: "balance", label: "Balance", headerClassName: "text-right", className: "text-right", render: (r) => <span className="text-sm font-semibold text-slate-900">{money(r.balance)}</span> },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Date", value: (r) => (r.date ? dateLabel(r.date) : "") },
    { label: "Type", value: (r) => (r.date ? typeLabel(r) : "") },
    { label: "Document", value: (r) => r.number ?? "" },
    { label: "Reference", value: (r) => r.reference ?? "" },
    { label: "Description", value: (r) => r.description ?? "" },
    { label: "Debit", value: (r) => num(r.debit), format: "money" },
    { label: "Credit", value: (r) => num(r.credit), format: "money" },
    { label: "Balance", value: (r) => num(r.balance), format: "money" },
  ];
  const exportRows: Row[] = report ? [{ id: "opening", date: "", type: "", number: t("Opening balance"), debit: 0, credit: 0, balance: report.opening, affectsBalance: true }, ...rows] : rows;
  const totalsRow = report ? ({ id: "totals", date: "", type: "", number: t("Total"), debit: report.debit, credit: report.credit, balance: report.closing, affectsBalance: true } as Row) : undefined;
  const partyName = options.find((o) => o.value === partyId)?.label;
  const details = partyId ? [{ label: party === "customer" ? "Customer" : "Vendor", value: partyName ?? `#${partyId}` }] : [];

  return (
    <>
      <PageMeta title={t(title)} description={party === "customer" ? "A customer's invoices, credit notes and payments with the balance" : "A vendor's bills, debit notes, payments and advances with the balance"} />
      <PageBreadcrumb pageTitle={title} />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={<ExportButtons modules={MODULES} disabled={loading || !report} report={{ title: partyName ? `${t(title)} — ${partyName}` : title, period, columns: exportColumns, rows: exportRows, totals: totalsRow, details }} />}
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          <SelectField
            label={party === "customer" ? "Customer" : "Vendor"}
            value={partyId}
            options={options}
            allLabel={party === "customer" ? "Choose a customer" : "Choose a vendor"}
            onChange={setPartyId}
          />
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} />

        {!partyId ? (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            {t(party === "customer" ? "Choose a customer to see their ledger." : "Choose a vendor to see their ledger.")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <TotalCard label="Opening balance" value={money(report?.opening)} hint={`${t(owedLabel)} · ${dateLabel(period.from)}`} />
              <TotalCard label="Debits" tone="green" value={money(report?.debit)} hint={t(party === "customer" ? "Invoiced" : "Paid and debited")} />
              <TotalCard label="Credits" tone="red" value={money(report?.credit)} hint={t(party === "customer" ? "Received and credited" : "Billed")} />
              <TotalCard label="Closing balance" tone="cyan" value={money(report?.closing)} hint={`${t(owedLabel)} · ${dateLabel(period.to)}`} />
            </div>

            <p className="text-xs text-slate-500">
              {t(
                party === "customer"
                  ? "The customer's statement: issued invoices, payments, credit notes and their reversals, in the documents' own currency. Grey lines are shown for reference and don't change the balance."
                  : "Bills (opening bills included), debit notes applied to them, approved payments and advances, in the documents' own currency. Grey lines are shown for reference and don't change the balance."
              )}
            </p>

            <ReusableTable
              data={rows}
              columns={columns}
              pageSize={50}
              loading={loading}
              searchable
              searchFields={["number", "reference", "description"]}
              searchPlaceholder={t("Search documents")}
              emptyState={
                <div className="flex flex-col items-center justify-center py-8">
                  <UserCircleIcon className="mb-3 h-12 w-12 text-gray-400" />
                  <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
                </div>
              }
            />
          </>
        )}
      </div>
    </>
  );
};

export const CustomerLedger: React.FC = () => <PartyLedger party="customer" />;
export const VendorLedger: React.FC = () => <PartyLedger party="vendor" />;
export default PartyLedger;
