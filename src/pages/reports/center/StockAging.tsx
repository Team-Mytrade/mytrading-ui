import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import { BarList, ExportButtons, ReportColumn, ReportWarnings, TotalCard, count, num } from "./reportKit";
import { t } from "../../../i18n/i18n";

interface Bucket {
  bucket: string;
  quantity: number;
  value: number;
}

interface AgingRow {
  productId: number;
  productCode?: string | null;
  productName?: string | null;
  quantity: number;
  value: number;
  averageCost: number;
  oldestDays?: number | null;
  lastReceived?: string | null;
  lastSold?: string | null;
  daysSinceSale?: number | null;
  buckets: Bucket[];
}

interface Aging {
  asOf: string;
  rows: AgingRow[];
  totals: Bucket[];
  quantity: number;
  value: number;
  products: number;
  warnings: string[];
}

type Row = AgingRow & { id: string };
const MODULES = ["INVENTORY"];
const BUCKET_LABELS: Record<string, string> = {
  "0-30": "0–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "91-180": "91–180 days",
  "181-365": "181–365 days",
  "365+": "Over a year",
  UNKNOWN: "Unknown age",
};
const bucketLabel = (b: string) => t(BUCKET_LABELS[b] ?? b);
const name = (r: AgingRow) => r.productName ?? r.productCode ?? `${t("Product")} #${r.productId}`;

/** Stock on hand by how long it has been in (backlog 8.2.1.6), oldest receipts out first, at average cost. */
const StockAging: React.FC = () => {
  const [report, setReport] = useState<Aging | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Aging>("/v1/api/inventory/reports/stock-aging", { skipSessionExpiredHandling: true } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the stock aging"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: String(r.productId) })), [report]);
  const totals = report?.totals ?? [];
  const over = (from: number) => totals.slice(from, 6).reduce((s, b) => s + num(b.value), 0);
  const chart = totals.map((b) => ({ key: b.bucket, label: bucketLabel(b.bucket), value: num(b.value), display: `${money(b.value)} · ${num(b.quantity).toLocaleString()}` }));
  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };

  const columns: ColumnDef<Row>[] = [
    {
      key: "productName",
      label: "Product",
      sortable: true,
      sortValueGetter: (r) => name(r),
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{name(r)}</span>
          {r.productCode && r.productName && <span className="block text-xs text-slate-500">{r.productCode}</span>}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "On hand",
      ...right,
      sortValueGetter: (r) => num(r.value),
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{money(r.value)}</span>
          <span className="block text-xs text-slate-500">{num(r.quantity).toLocaleString()}</span>
        </span>
      ),
    },
    ...(report?.totals ?? []).map(
      (b, i): ColumnDef<Row> => ({
        key: `b-${b.bucket}`,
        label: bucketLabel(b.bucket),
        ...right,
        sortValueGetter: (r) => num(r.buckets[i]?.quantity),
        render: (r) => {
          const q = num(r.buckets[i]?.quantity);
          return <span className={`text-sm ${q === 0 ? "text-slate-300" : i >= 4 ? "font-medium text-red-600" : "text-slate-700"}`}>{q === 0 ? "—" : q.toLocaleString()}</span>;
        },
      })
    ),
    {
      key: "daysSinceSale",
      label: "Last sold",
      ...right,
      sortValueGetter: (r) => (r.daysSinceSale == null ? Number.MAX_SAFE_INTEGER : r.daysSinceSale),
      render: (r) => (
        <span className="text-sm text-slate-600">
          {r.lastSold ? dateLabel(r.lastSold) : t("Never")}
          {r.daysSinceSale != null && <span className="block text-xs text-slate-500">{count(r.daysSinceSale, "day ago", "days ago")}</span>}
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Product", value: (r) => (r.id === "totals" ? t("Total") : name(r)) },
    { label: "Code", value: (r) => r.productCode ?? "" },
    { label: "Quantity", value: (r) => num(r.quantity), format: "number" },
    { label: "Value", value: (r) => num(r.value), format: "money" },
    ...(report?.totals ?? []).map((b, i) => ({ label: bucketLabel(b.bucket), value: (r: Row) => num(r.buckets[i]?.quantity), format: "number" }) as ReportColumn<Row>),
    { label: "Last sold", value: (r) => (r.lastSold ? dateLabel(r.lastSold) : "") },
  ];
  const totalsRow: Row | undefined = report ? { id: "totals", productId: 0, quantity: report.quantity, value: report.value, averageCost: 0, buckets: report.totals } : undefined;
  const asOf = report?.asOf ?? "";

  return (
    <>
      <PageMeta title={t("Stock Aging")} description="Stock on hand by how long it has been in" />
      <PageBreadcrumb pageTitle="Stock Aging" />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">{`${t("Stock on hand as of")} ${dateLabel(asOf)}`}</p>
          <ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Stock Aging", period: { preset: "custom", from: asOf, to: asOf }, columns: exportColumns, rows, totals: totalsRow }} />
        </div>

        <ReportWarnings warnings={report?.warnings} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Stock value" tone="cyan" value={money(report?.value)} hint={count(report?.products, "product", "products")} />
          <TotalCard label="Over 90 days" tone="red" value={money(over(3))} hint={t("Received more than three months ago")} />
          <TotalCard label="Over a year" tone="red" value={money(over(5))} />
          <TotalCard label="Unknown age" value={money(totals[6]?.value)} hint={t("No receipt explains it")} />
        </div>

        <BarList title="Stock value by age" rows={chart} empty={loading ? "Loading…" : "No stock on hand"} />

        <p className="text-xs text-slate-500">
          {t("Stock in your own warehouses is matched to the receipts that brought it in, newest first, as stock goes out oldest first; what no receipt explains is of unknown age. Transfers between warehouses don't make stock younger. Valued at the average cost.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["productName", "productCode"]}
          searchPlaceholder={t("Search products")}
          defaultSortKey="quantity"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ArchiveBoxIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No stock on hand")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default StockAging;
