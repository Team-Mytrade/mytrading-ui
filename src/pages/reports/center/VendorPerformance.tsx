import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { TrophyIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, money } from "../../Invoice/invoiceShared";
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
  useSyncedParams,
  useVendorOptions,
} from "./reportKit";
import { t } from "../../../i18n/i18n";

interface VendorRow {
  vendorId?: number | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  receipts: number;
  orders: number;
  onTime: number;
  withDueDate: number;
  onTimePercent?: number | null;
  averageDaysLate?: number | null;
  receivedQuantity: number;
  rejectedQuantity: number;
  rejectedPercent?: number | null;
  returnedQuantity: number;
  spend: number;
  priceVsAverage?: number | null;
  productsCompared: number;
}

interface Performance {
  rows: VendorRow[];
  totals: { vendors: number; receipts: number; onTimePercent?: number | null; rejectedPercent?: number | null; spend: number };
  warnings?: string[];
  missingRates?: string[];
}

type Row = VendorRow & { id: string };

const MODULES = ["PURCHASE", "INVOICE"];
const API = "/v1/api/purchase/report-center/vendor-performance";
const pct = (value?: number | null, signed = false) =>
  value === null || value === undefined ? "—" : `${signed && num(value) > 0 ? "+" : ""}${num(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

/** How each vendor delivered and priced in a period (backlog 8.2.1.4): on time, rejected, returned, price against others. */
const VendorPerformance: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "this-quarter"));
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [report, setReport] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(false);
  const vendors = useVendorOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Performance>(API, {
        params: { from: period.from, to: period.to, vendorId: vendorId || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the vendor performance"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, vendorId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r, i) => ({ ...r, id: String(r.vendorId ?? `v${i}`) })), [report]);
  const totals = report?.totals;
  const chart = useMemo(
    () =>
      rows
        .filter((r) => r.onTimePercent !== null && r.onTimePercent !== undefined)
        .slice(0, 10)
        .map((r) => ({ key: r.id, label: r.vendorName ?? r.vendorCode ?? "—", value: num(r.onTimePercent), display: `${pct(r.onTimePercent)} · ${count(r.withDueDate, "receipt", "receipts")}` })),
    [rows]
  );

  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };
  const columns: ColumnDef<Row>[] = [
    {
      key: "vendorName",
      label: "Vendor",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.vendorName ?? "—"}</span>
          {r.vendorCode && <span className="block text-xs text-slate-500">{r.vendorCode}</span>}
        </span>
      ),
    },
    { key: "spend", label: "Bought", ...right, sortValueGetter: (r) => num(r.spend), render: (r) => <span className="text-sm font-semibold text-slate-900">{money(r.spend)}</span> },
    {
      key: "receipts",
      label: "Receipts",
      ...right,
      render: (r) => (
        <span className="text-sm text-slate-700">
          {r.receipts}
          <span className="block text-xs text-slate-500">{count(r.orders, "order", "orders")}</span>
        </span>
      ),
    },
    {
      key: "onTimePercent",
      label: "On time",
      ...right,
      sortValueGetter: (r) => (r.onTimePercent == null ? -1 : num(r.onTimePercent)),
      render: (r) => (
        <span className="text-sm">
          <span className={num(r.onTimePercent) < 80 && r.onTimePercent != null ? "font-semibold text-red-600" : "text-slate-800"}>{pct(r.onTimePercent)}</span>
          {r.averageDaysLate != null && <span className="block text-xs text-slate-500">{`${t("Late by")} ${num(r.averageDaysLate).toLocaleString()} ${t("days on average")}`}</span>}
        </span>
      ),
    },
    {
      key: "rejectedPercent",
      label: "Rejected",
      ...right,
      sortValueGetter: (r) => num(r.rejectedPercent),
      render: (r) => (
        <span className="text-sm">
          <span className={num(r.rejectedPercent) > 0 ? "text-red-600" : "text-slate-700"}>{pct(r.rejectedPercent)}</span>
          <span className="block text-xs text-slate-500">{`${num(r.rejectedQuantity).toLocaleString()} ${t("of")} ${num(r.receivedQuantity).toLocaleString()}`}</span>
        </span>
      ),
    },
    { key: "returnedQuantity", label: "Sent back", ...right, render: (r) => <span className="text-sm text-slate-700">{num(r.returnedQuantity).toLocaleString()}</span> },
    {
      key: "priceVsAverage",
      label: "Price vs average",
      ...right,
      sortValueGetter: (r) => (r.priceVsAverage == null ? 0 : num(r.priceVsAverage)),
      render: (r) => (
        <span className="text-sm">
          <span className={num(r.priceVsAverage) > 0 ? "text-red-600" : num(r.priceVsAverage) < 0 ? "text-green-700" : "text-slate-700"}>{pct(r.priceVsAverage, true)}</span>
          {r.productsCompared > 0 && <span className="block text-xs text-slate-500">{count(r.productsCompared, "product compared", "products compared")}</span>}
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Vendor", value: (r) => r.vendorName ?? "" },
    { label: "Code", value: (r) => r.vendorCode ?? "" },
    { label: "Bought", value: (r) => num(r.spend), format: "money" },
    { label: "Receipts", value: (r) => r.receipts, format: "number" },
    { label: "Orders", value: (r) => r.orders, format: "number" },
    { label: "On time", value: (r) => (r.onTimePercent == null ? "" : num(r.onTimePercent)), format: "percent" },
    { label: "Average days late", value: (r) => (r.averageDaysLate == null ? "" : num(r.averageDaysLate)), format: "number" },
    { label: "Received quantity", value: (r) => r.receivedQuantity, format: "number" },
    { label: "Rejected quantity", value: (r) => r.rejectedQuantity, format: "number" },
    { label: "Rejected", value: (r) => (r.rejectedPercent == null ? "" : num(r.rejectedPercent)), format: "percent" },
    { label: "Sent back", value: (r) => r.returnedQuantity, format: "number" },
    { label: "Price vs average", value: (r) => (r.priceVsAverage == null ? "" : num(r.priceVsAverage)), format: "percent" },
  ];
  const totalsRow = totals
    ? ({
        id: "totals",
        vendorName: t("Total"),
        receipts: totals.receipts,
        orders: rows.reduce((s, r) => s + r.orders, 0),
        onTime: 0,
        withDueDate: 0,
        onTimePercent: totals.onTimePercent,
        receivedQuantity: rows.reduce((s, r) => s + num(r.receivedQuantity), 0),
        rejectedQuantity: rows.reduce((s, r) => s + num(r.rejectedQuantity), 0),
        rejectedPercent: totals.rejectedPercent,
        returnedQuantity: rows.reduce((s, r) => s + num(r.returnedQuantity), 0),
        spend: totals.spend,
        productsCompared: 0,
      } as Row)
    : undefined;
  const details = vendorId ? [{ label: "Vendor", value: vendors.find((v) => v.value === vendorId)?.label ?? `#${vendorId}` }] : [];

  return (
    <>
      <PageMeta title={t("Vendor Performance")} description="Vendors' delivery, quality and prices in a period" />
      <PageBreadcrumb pageTitle="Vendor Performance" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Vendor Performance", period, columns: exportColumns, rows, totals: totalsRow, details }} />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {vendors.length > 0 && <SelectField label="Vendor" value={vendorId} options={vendors} allLabel="All vendors" onChange={setVendorId} />}
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="On time" tone="green" value={pct(totals?.onTimePercent)} hint={count(totals?.receipts, "goods receipt", "goods receipts")} />
          <TotalCard label="Rejected" tone="red" value={pct(totals?.rejectedPercent)} hint={t("Of the quantity received")} />
          <TotalCard label="Bought" tone="cyan" value={money(totals?.spend)} hint={t("Accepted, before tax")} />
          <TotalCard label="Vendors" value={String(totals?.vendors ?? 0)} hint={t("Delivered in the period")} />
        </div>

        <BarList title="On time by vendor" rows={chart} empty={loading ? "Loading…" : "No deliveries with a due date in this period"} />

        <p className="text-xs text-slate-500">
          {t("Goods receipts in the period. On time: received on or before the order's expected delivery date. Rejected: quantity refused at receipt. Price vs average: what the vendor charged against the average paid to any vendor for the same products, for products bought from more than one; minus is cheaper.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["vendorName", "vendorCode"]}
          searchPlaceholder={t("Search vendors")}
          defaultSortKey="spend"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <TrophyIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default VendorPerformance;
