import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, labelOf, money } from "../../Invoice/invoiceShared";
import {
  BarList,
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

interface ReturnRow {
  source: "ORDER" | "COUNTER";
  id: number;
  number?: string | null;
  date?: string | null;
  orderNumber?: string | null;
  customerName?: string | null;
  salesPersonName?: string | null;
  reason: string;
  note?: string | null;
  resolution: string;
  status?: string | null;
  quantity: number;
  currency?: string | null;
  documentValue?: number | null;
  value?: number | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  refundDate?: string | null;
  paidBack?: number | null;
  creditNotes?: string | null;
}

interface Returns {
  rows: ReturnRow[];
  reasons: { reason: string; returns: number; value: number }[];
  totals: { returns: number; quantity: number; value: number; refunded: number; refundPending: number; exchanges: number; rejected: number; counterReturns: number };
  warnings?: string[];
  missingRates?: string[];
}

type Row = Omit<ReturnRow, "id"> & { id: string; returnId: number };

const MODULES = ["SALES", "INVOICE"];
const API = "/v1/api/sales/report-center/returns";

/** Why goods came back; counter (POS) returns have their own reason line. */
const reasonLabel = (reason: string) => (reason === "COUNTER" ? t("Counter return") : labelOf(reason));

/** Returns of a period with their refunds (backlog 8.2.1.2): sales order returns and counter returns. */
const ReturnsRefunds: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [salesPersonId, setSalesPersonId] = useState(params.get("salesPersonId") ?? "");
  const [report, setReport] = useState<Returns | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers, salesPersons } = useSalesFilterOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Returns>(API, {
        params: { from: period.from, to: period.to, customerId: customerId || undefined, salesPersonId: salesPersonId || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the returns"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, customerId, salesPersonId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, customerId, salesPersonId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, returnId: r.id, id: `${r.source}-${r.id}` })), [report]);
  const totals = report?.totals;
  const chart = useMemo(
    () => (report?.reasons ?? []).map((r) => ({ key: r.reason, label: `${reasonLabel(r.reason)} (${r.returns})`, value: num(r.value), display: money(r.value) })),
    [report]
  );
  const rejected = (r: Row) => r.status === "REJECTED";
  const refundText = (r: Row) =>
    r.resolution === "EXCHANGE"
      ? t("Exchanged")
      : r.refundStatus
        ? `${labelOf(r.refundStatus)}${r.refundAmount != null ? ` · ${money(r.refundAmount)}` : ""}${r.refundDate ? ` · ${dateLabel(r.refundDate)}` : ""}`
        : rejected(r)
          ? "—"
          : t("Not refunded yet");

  const columns: ColumnDef<Row>[] = [
    {
      key: "number",
      label: "Return",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className={`font-semibold ${rejected(r) ? "text-slate-400 line-through" : "text-slate-900"}`}>{r.number ?? "—"}</span>
          <span className="block text-xs text-slate-500">{t(r.source === "COUNTER" ? "Counter return" : "Order return")}</span>
        </span>
      ),
    },
    { key: "date", label: "Date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    { key: "orderNumber", label: "Order or sale", sortable: true, render: (r) => <span className="text-sm text-slate-600">{r.orderNumber ?? "—"}</span> },
    { key: "customerName", label: "Customer", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.customerName ?? "—"}</span> },
    {
      key: "reason",
      label: "Reason",
      sortable: true,
      render: (r) => (
        <span className="text-sm text-slate-700" title={r.note ?? undefined}>
          {reasonLabel(r.reason)}
          {r.source === "COUNTER" && r.note && <span className="block text-xs text-slate-500">{r.note}</span>}
        </span>
      ),
    },
    { key: "status", label: "Status", sortable: true, render: (r) => <span className="text-sm text-slate-600">{labelOf(r.status)}</span> },
    {
      key: "value",
      label: "Value",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.value),
      render: (r) => (
        <span className="text-sm">
          <span className={rejected(r) ? "text-slate-400" : "font-semibold text-slate-900"}>{r.value == null ? "—" : money(r.value)}</span>
          <span className="block text-xs text-slate-500">{count(r.quantity, "unit returned", "units returned")}</span>
        </span>
      ),
    },
    {
      key: "refundStatus",
      label: "Refund",
      sortable: true,
      render: (r) => (
        <span className="text-sm text-slate-600">
          {refundText(r)}
          {r.creditNotes && <span className="block text-xs text-slate-500">{r.creditNotes}</span>}
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Return", value: (r) => r.number ?? "" },
    { label: "Type", value: (r) => (r.id === "totals" ? "" : t(r.source === "COUNTER" ? "Counter return" : "Order return")) },
    { label: "Date", value: (r) => (r.date ? dateLabel(r.date) : "") },
    { label: "Order or sale", value: (r) => r.orderNumber ?? "" },
    { label: "Customer", value: (r) => r.customerName ?? "" },
    { label: "Sales person", value: (r) => r.salesPersonName ?? "" },
    { label: "Reason", value: (r) => (r.id === "totals" ? "" : reasonLabel(r.reason)) },
    { label: "Status", value: (r) => (r.status ? labelOf(r.status) : "") },
    { label: "Quantity", value: (r) => num(r.quantity), format: "number" },
    { label: "Value", value: (r) => num(r.value), format: "money" },
    { label: "Refund", value: (r) => (r.id === "totals" ? "" : refundText(r)) },
    { label: "Paid back", value: (r) => (r.paidBack == null ? "" : num(r.paidBack)), format: "money" },
    { label: "Credit notes", value: (r) => r.creditNotes ?? "" },
  ];
  const totalsRow = totals
    ? ({ id: "totals", returnId: 0, source: "ORDER", number: t("Total"), reason: "", resolution: "", quantity: totals.quantity, value: totals.value } as Row)
    : undefined;
  const details = [
    ...(customerId ? [{ label: "Customer", value: customers.find((c) => c.value === customerId)?.label ?? `#${customerId}` }] : []),
    ...(salesPersonId ? [{ label: "Sales person", value: salesPersons.find((p) => p.value === salesPersonId)?.label ?? `#${salesPersonId}` }] : []),
  ];

  return (
    <>
      <PageMeta title={t("Returns & Refunds")} description="Goods returned in a period and their refunds" />
      <PageBreadcrumb pageTitle="Returns & Refunds" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons
              modules={MODULES}
              disabled={loading || rows.length === 0}
              report={{ title: "Returns & Refunds", period, columns: exportColumns, rows, totals: totalsRow, details }}
            />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {customers.length > 0 && <SelectField label="Customer" value={customerId} options={customers} allLabel="All customers" onChange={setCustomerId} />}
          {salesPersons.length > 0 && (
            <SelectField label="Sales person" value={salesPersonId} options={salesPersons} allLabel="All sales persons" onChange={setSalesPersonId} />
          )}
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard
            label="Returns"
            tone="cyan"
            value={String(totals?.returns ?? 0)}
            hint={`${count(totals?.exchanges, "exchange", "exchanges")} · ${count(totals?.rejected, "rejected", "rejected")}`}
          />
          <TotalCard label="Value returned" value={money(totals?.value)} hint={count(totals?.quantity, "unit returned", "units returned")} />
          <TotalCard label="Refunded" tone="green" value={money(totals?.refunded)} hint={count(totals?.counterReturns, "at the counter", "at the counter")} />
          <TotalCard label="Still to refund" tone="red" value={money(totals?.refundPending)} hint={t("Money-back returns not refunded yet")} />
        </div>

        <BarList title="Returns by reason" rows={chart} empty={loading ? "Loading…" : "Nothing in this period"} />

        <p className="text-xs text-slate-500">
          {t("Sales order returns by their request date and counter returns by their day. Values are what each return refunds, with tax, in the company currency; rejected returns are listed but not counted.")}{" "}
          <Link to="/return-requests" className="font-medium text-cyan-700 hover:underline">
            {t("Return Requests")}
          </Link>
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["number", "orderNumber", "customerName", "creditNotes"]}
          searchPlaceholder={t("Search returns or customers")}
          defaultSortKey="date"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ArrowUturnLeftIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default ReturnsRefunds;
