import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { INVOICE_API, apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import {
  ExportButtons,
  FilterBar,
  Period,
  PeriodPicker,
  ReportColumn,
  SelectField,
  TotalCard,
  initialPeriod,
  count,
  num,
  useSalesFilterOptions,
  useSyncedParams,
} from "./reportKit";
import { t } from "../../../i18n/i18n";

export interface SalesTotals {
  invoiced: number;
  credited: number;
  net: number;
  tax: number;
  total: number;
  quantity: number;
  invoices: number;
  creditNotes: number;
}

interface RegisterRow {
  date: string;
  type: "INVOICE" | "CREDIT_NOTE";
  documentId: number;
  number?: string | null;
  invoiceNumber?: string | null;
  customerId?: number | null;
  customerCode?: string | null;
  customerName?: string | null;
  salesPersonName?: string | null;
  currency?: string | null;
  documentTotal?: number | null;
  net: number;
  tax: number;
  total: number;
  status?: string | null;
}

interface Register {
  from: string;
  to: string;
  rows: RegisterRow[];
  totals: SalesTotals;
}

type Row = RegisterRow & { id: string };

const MODULES = ["SALES", "INVOICE"];

/** Every issued invoice and credit note in a period (backlog 8.2.1): net, tax and total in the company currency. */
const SalesRegister: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [salesPersonId, setSalesPersonId] = useState(params.get("salesPersonId") ?? "");
  const [report, setReport] = useState<Register | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers, salesPersons } = useSalesFilterOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Register>(`${INVOICE_API}/reports/sales/register`, {
        params: { from: period.from, to: period.to, customerId: customerId || undefined, salesPersonId: salesPersonId || undefined },
        // A 403 is a missing report right, not an expired login
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the sales register"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, customerId, salesPersonId]);

  useEffect(() => {
    load();
  }, [load]);

  // The filters stay in the address, so the report can be bookmarked or shared
  useSyncedParams(setParams, { from: period.from, to: period.to, customerId, salesPersonId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: `${r.type}-${r.documentId}` })), [report]);
  const totals = report?.totals;
  const typeLabel = (row: RegisterRow) => t(row.type === "CREDIT_NOTE" ? "Credit note" : "Invoice");

  const columns: ColumnDef<Row>[] = [
    { key: "date", label: "Date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    {
      key: "number",
      label: "Document",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.number ?? "—"}</span>
          <span className={`block text-xs ${r.type === "CREDIT_NOTE" ? "text-red-600" : "text-slate-500"}`}>
            {typeLabel(r)}
            {r.type === "CREDIT_NOTE" && r.invoiceNumber ? ` · ${r.invoiceNumber}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      render: (r) => <span className="text-sm text-slate-700">{r.customerName ?? r.customerCode ?? "—"}</span>,
    },
    { key: "salesPersonName", label: "Sales person", sortable: true, render: (r) => <span className="text-sm text-slate-600">{r.salesPersonName ?? "—"}</span> },
    {
      key: "documentTotal",
      label: "Document currency",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (r) => <span className="text-sm text-slate-500">{r.currency ? money(r.documentTotal, r.currency) : "—"}</span>,
    },
    ...(["net", "tax", "total"] as const).map(
      (key): ColumnDef<Row> => ({
        key,
        label: key === "net" ? "Net" : key === "tax" ? "Tax" : "Total",
        sortable: true,
        headerClassName: "text-right",
        className: "text-right",
        sortValueGetter: (r) => num(r[key]),
        render: (r) => <span className={`text-sm ${num(r[key]) < 0 ? "text-red-600" : key === "total" ? "font-semibold text-slate-900" : "text-slate-700"}`}>{money(r[key])}</span>,
      })
    ),
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Date", value: (r) => (r.date ? dateLabel(r.date) : "") },
    { label: "Type", value: (r) => (r.date ? typeLabel(r) : "") },
    { label: "Document", value: (r) => r.number ?? "" },
    { label: "Invoice", value: (r) => (r.type === "CREDIT_NOTE" ? r.invoiceNumber ?? "" : "") },
    { label: "Customer", value: (r) => r.customerName ?? r.customerCode ?? "" },
    { label: "Sales person", value: (r) => r.salesPersonName ?? "" },
    { label: "Net", value: (r) => num(r.net), format: "money" },
    { label: "Tax", value: (r) => num(r.tax), format: "money" },
    { label: "Total", value: (r) => num(r.total), format: "money" },
  ];
  const totalsRow = totals
    ? ({ id: "totals", date: "", type: "INVOICE", documentId: 0, number: t("Total"), net: totals.net, tax: totals.tax, total: totals.total } as Row)
    : undefined;
  const details = [
    ...(customerId ? [{ label: "Customer", value: customers.find((c) => c.value === customerId)?.label ?? `#${customerId}` }] : []),
    ...(salesPersonId ? [{ label: "Sales person", value: salesPersons.find((p) => p.value === salesPersonId)?.label ?? `#${salesPersonId}` }] : []),
  ];

  return (
    <>
      <PageMeta title={t("Sales Register")} description="Issued invoices and credit notes in a period" />
      <PageBreadcrumb pageTitle="Sales Register" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons
              modules={MODULES}
              disabled={loading || rows.length === 0}
              report={{ title: "Sales Register", period, columns: exportColumns, rows, totals: totalsRow, details }}
            />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {customers.length > 0 && <SelectField label="Customer" value={customerId} options={customers} allLabel="All customers" onChange={setCustomerId} />}
          {salesPersons.length > 0 && (
            <SelectField label="Sales person" value={salesPersonId} options={salesPersons} allLabel="All sales persons" onChange={setSalesPersonId} />
          )}
        </FilterBar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Invoiced" tone="cyan" value={money(totals?.invoiced)} hint={count(totals?.invoices, "invoice", "invoices")} />
          <TotalCard label="Credit notes" tone="red" value={money(totals?.credited)} hint={count(totals?.creditNotes, "credit note", "credit notes")} />
          <TotalCard label="Net sales" tone="green" value={money(totals?.net)} hint={t("Before tax")} />
          <TotalCard label="Total with tax" value={money(totals?.total)} hint={`${t("Tax")} ${money(totals?.tax)}`} />
        </div>

        <p className="text-xs text-slate-500">
          {t("Issued invoices by invoice date and issued credit notes by their date; drafts, cancelled and opening invoices are left out. Amounts are in the company currency.")}{" "}
          <Link to={`/reports/sales-analysis?from=${period.from}&to=${period.to}`} className="font-medium text-cyan-700 hover:underline">
            {t("Sales Analysis")}
          </Link>
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["number", "invoiceNumber", "customerName", "salesPersonName"]}
          searchPlaceholder={t("Search documents or customers")}
          defaultSortKey="date"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <DocumentMagnifyingGlassIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default SalesRegister;
