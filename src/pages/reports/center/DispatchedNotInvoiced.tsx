import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { TruckIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { AuthContext } from "../../../context/AuthContext";
import { hasPermission } from "../../../access/access";
import { INVOICE_API, apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import {
  ExportButtons,
  FilterBar,
  Period,
  PeriodPicker,
  ReportColumn,
  ReportWarnings,
  SelectField,
  TotalCard,
  count,
  initialPeriod,
  num,
  useSalesFilterOptions,
  useSyncedParams,
} from "./reportKit";
import { t } from "../../../i18n/i18n";

type Stage = "NOT_INVOICED" | "DRAFT_INVOICE" | "CANCELLED_INVOICE";

interface UninvoicedRow {
  dispatchId: number;
  dispatchNumber?: string | null;
  dispatchDate?: string | null;
  daysWaiting: number;
  salesOrderNumber?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  salesPersonName?: string | null;
  stage: Stage;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  currency?: string | null;
  documentTotal?: number | null;
  net?: number | null;
  tax?: number | null;
  total?: number | null;
}

interface Uninvoiced {
  rows: UninvoicedRow[];
  totals: { dispatches: number; net: number; tax: number; total: number; overAWeek: number; draftInvoices: number; cancelledInvoices: number; oldestDays: number };
  warnings?: string[];
  missingRates?: string[];
}

type Row = UninvoicedRow & { id: string };

const MODULES = ["SALES", "INVOICE"];
const STAGES: Record<Stage, { label: string; tone: string }> = {
  NOT_INVOICED: { label: "Not invoiced", tone: "bg-amber-50 text-amber-700" },
  DRAFT_INVOICE: { label: "Draft invoice", tone: "bg-cyan-50 text-cyan-700" },
  CANCELLED_INVOICE: { label: "Invoice cancelled", tone: "bg-red-50 text-red-700" },
};

/** Confirmed dispatches no issued invoice bills yet (backlog 8.2.1.2): what went out and still has to be invoiced. */
const DispatchedNotInvoiced: React.FC = () => {
  const { access } = useContext(AuthContext);
  const canInvoice = access.superAdmin || hasPermission(access, "INVOICE:CREATE");
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "all"));
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [salesPersonId, setSalesPersonId] = useState(params.get("salesPersonId") ?? "");
  const [report, setReport] = useState<Uninvoiced | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers, salesPersons } = useSalesFilterOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Uninvoiced>(`${INVOICE_API}/reports/sales/dispatched-not-invoiced`, {
        params: {
          from: period.from || undefined,
          to: period.to || undefined,
          customerId: customerId || undefined,
          salesPersonId: salesPersonId || undefined,
        },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the dispatches not invoiced"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, customerId, salesPersonId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, customerId, salesPersonId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: String(r.dispatchId) })), [report]);
  const totals = report?.totals;
  const stageLabel = (r: UninvoicedRow) => `${t(STAGES[r.stage]?.label ?? r.stage)}${r.invoiceNumber ? ` · ${r.invoiceNumber}` : ""}`;

  const columns: ColumnDef<Row>[] = [
    {
      key: "dispatchNumber",
      label: "Dispatch",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.dispatchNumber ?? "—"}</span>
          {r.salesOrderNumber && <span className="block text-xs text-slate-500">{r.salesOrderNumber}</span>}
        </span>
      ),
    },
    { key: "dispatchDate", label: "Dispatch date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.dispatchDate)}</span> },
    {
      key: "daysWaiting",
      label: "Waiting",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (r) => <span className={`text-sm ${r.daysWaiting > 7 ? "font-semibold text-red-600" : "text-slate-700"}`}>{count(r.daysWaiting, "day", "days")}</span>,
    },
    { key: "customerName", label: "Customer", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.customerName ?? r.customerCode ?? "—"}</span> },
    { key: "salesPersonName", label: "Sales person", sortable: true, render: (r) => <span className="text-sm text-slate-600">{r.salesPersonName ?? "—"}</span> },
    {
      key: "stage",
      label: "Stage",
      sortable: true,
      render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGES[r.stage]?.tone ?? "bg-slate-100 text-slate-600"}`}>{stageLabel(r)}</span>,
    },
    {
      key: "net",
      label: "Net",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.net),
      render: (r) => (
        <span className="text-sm">
          <span className="text-slate-800">{r.net == null ? "—" : money(r.net)}</span>
          {r.currency && r.net !== null && num(r.documentTotal) !== num(r.total) && (
            <span className="block text-xs text-slate-500">{money(r.documentTotal, r.currency)}</span>
          )}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.total),
      render: (r) => <span className="text-sm font-semibold text-slate-900">{r.total == null ? "—" : money(r.total)}</span>,
    },
    {
      key: "action",
      label: "",
      render: (r) =>
        r.stage === "NOT_INVOICED" ? (
          canInvoice ? (
            <Link to={`/invoices?dispatchId=${r.dispatchId}`} className="text-sm font-medium text-cyan-700 hover:underline">
              {t("Invoice it")}
            </Link>
          ) : null
        ) : r.invoiceId ? (
          <Link to={`/invoices?invoiceId=${r.invoiceId}`} className="text-sm font-medium text-cyan-700 hover:underline">
            {t("Open invoice")}
          </Link>
        ) : null,
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Dispatch", value: (r) => r.dispatchNumber ?? "" },
    { label: "Sales order", value: (r) => r.salesOrderNumber ?? "" },
    { label: "Dispatch date", value: (r) => (r.dispatchDate ? dateLabel(r.dispatchDate) : "") },
    { label: "Days waiting", value: (r) => (r.id === "totals" ? "" : r.daysWaiting), format: "number" },
    { label: "Customer", value: (r) => r.customerName ?? r.customerCode ?? "" },
    { label: "Sales person", value: (r) => r.salesPersonName ?? "" },
    { label: "Stage", value: (r) => (r.id === "totals" ? "" : stageLabel(r)) },
    { label: "Net", value: (r) => num(r.net), format: "money" },
    { label: "Tax", value: (r) => num(r.tax), format: "money" },
    { label: "Total", value: (r) => num(r.total), format: "money" },
  ];
  const totalsRow = totals
    ? ({ id: "totals", dispatchId: 0, dispatchNumber: t("Total"), daysWaiting: 0, stage: "NOT_INVOICED", net: totals.net, tax: totals.tax, total: totals.total } as Row)
    : undefined;
  const details = [
    ...(customerId ? [{ label: "Customer", value: customers.find((c) => c.value === customerId)?.label ?? `#${customerId}` }] : []),
    ...(salesPersonId ? [{ label: "Sales person", value: salesPersons.find((p) => p.value === salesPersonId)?.label ?? `#${salesPersonId}` }] : []),
  ];

  return (
    <>
      <PageMeta title={t("Dispatched Not Invoiced")} description="Confirmed dispatches no issued invoice bills yet" />
      <PageBreadcrumb pageTitle="Dispatched Not Invoiced" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons
              modules={MODULES}
              disabled={loading || rows.length === 0}
              report={{ title: "Dispatched Not Invoiced", period, columns: exportColumns, rows, totals: totalsRow, details }}
            />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} allowAll label="Dispatch date" />
          {customers.length > 0 && <SelectField label="Customer" value={customerId} options={customers} allLabel="All customers" onChange={setCustomerId} />}
          {salesPersons.length > 0 && (
            <SelectField label="Sales person" value={salesPersonId} options={salesPersons} allLabel="All sales persons" onChange={setSalesPersonId} />
          )}
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Waiting to be invoiced" tone="cyan" value={money(totals?.total)} hint={count(totals?.dispatches, "dispatch to invoice", "dispatches to invoice")} />
          <TotalCard label="Before tax" tone="green" value={money(totals?.net)} hint={`${t("Tax")} ${money(totals?.tax)}`} />
          <TotalCard label="Over a week" tone="red" value={String(totals?.overAWeek ?? 0)} hint={count(totals?.oldestDays, "day for the oldest", "days for the oldest")} />
          <TotalCard
            label="Invoice started"
            value={String((totals?.draftInvoices ?? 0) + (totals?.cancelledInvoices ?? 0))}
            hint={`${count(totals?.draftInvoices, "draft invoice", "draft invoices")} · ${count(totals?.cancelledInvoices, "cancelled invoice", "cancelled invoices")}`}
          />
        </div>

        <p className="text-xs text-slate-500">
          {t("Confirmed dispatches with no issued invoice: none made yet, only a draft, or an invoice that was cancelled. Valued at the order's prices in the company currency; oldest first.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["dispatchNumber", "salesOrderNumber", "customerName", "invoiceNumber"]}
          searchPlaceholder={t("Search dispatches or customers")}
          defaultSortKey="daysWaiting"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <TruckIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Everything dispatched is invoiced")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default DispatchedNotInvoiced;
