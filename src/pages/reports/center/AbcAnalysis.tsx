import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { ChartPieIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, money } from "../../Invoice/invoiceShared";
import { ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, ReportWarnings, TotalCard, count, initialPeriod, num, useSyncedParams } from "./reportKit";
import { t } from "../../../i18n/i18n";

interface AbcRow {
  productId: number;
  productCode?: string | null;
  productName?: string | null;
  abcClass: "A" | "B" | "C" | "NONE";
  quantitySold: number;
  value: number;
  share: number;
  cumulativeShare?: number | null;
  stockQuantity: number;
  stockValue: number;
}

interface Abc {
  rows: AbcRow[];
  classes: { abcClass: string; products: number; value: number; share: number; stockValue: number }[];
  total: number;
  warnings: string[];
}

type Row = AbcRow & { id: string };
const MODULES = ["INVENTORY"];
const CLASS_TONES: Record<string, string> = {
  A: "bg-green-50 text-green-700",
  B: "bg-cyan-50 text-cyan-700",
  C: "bg-slate-100 text-slate-600",
  NONE: "bg-amber-50 text-amber-700",
};
const classLabel = (c: string) => (c === "NONE" ? t("No sales") : c);
const name = (r: AbcRow) => r.productName ?? r.productCode ?? `${t("Product")} #${r.productId}`;
const pct = (v?: number | null) => (v == null ? "—" : `${num(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`);

/** Products ranked A / B / C by what their sales cost in a period (backlog 8.2.1.6), with the stock held of each. */
const AbcAnalysis: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "this-year"));
  const [report, setReport] = useState<Abc | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!period.from || !period.to) return;
    try {
      setLoading(true);
      const res = await axios.get<Abc>("/v1/api/inventory/reports/abc-analysis", { params: { from: period.from, to: period.to }, skipSessionExpiredHandling: true } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the ABC analysis"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: String(r.productId) })), [report]);
  const classes = Object.fromEntries((report?.classes ?? []).map((c) => [c.abcClass, c]));
  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };

  const columns: ColumnDef<Row>[] = [
    {
      key: "abcClass",
      label: "Class",
      sortable: true,
      render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLASS_TONES[r.abcClass]}`}>{classLabel(r.abcClass)}</span>,
    },
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
    { key: "quantitySold", label: "Sold", ...right, render: (r) => <span className="text-sm text-slate-700">{num(r.quantitySold).toLocaleString()}</span> },
    { key: "value", label: "Cost of sales", ...right, sortValueGetter: (r) => num(r.value), render: (r) => <span className="text-sm font-semibold text-slate-900">{money(r.value)}</span> },
    { key: "share", label: "Share", ...right, sortValueGetter: (r) => num(r.share), render: (r) => <span className="text-sm text-slate-600">{pct(r.share)}</span> },
    { key: "cumulativeShare", label: "Cumulative", ...right, sortValueGetter: (r) => num(r.cumulativeShare), render: (r) => <span className="text-sm text-slate-500">{pct(r.cumulativeShare)}</span> },
    {
      key: "stockValue",
      label: "In stock",
      ...right,
      sortValueGetter: (r) => num(r.stockValue),
      render: (r) => (
        <span className="text-sm">
          <span className="text-slate-800">{money(r.stockValue)}</span>
          <span className="block text-xs text-slate-500">{num(r.stockQuantity).toLocaleString()}</span>
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Class", value: (r) => (r.id === "totals" ? "" : classLabel(r.abcClass)) },
    { label: "Product", value: (r) => (r.id === "totals" ? t("Total") : name(r)) },
    { label: "Code", value: (r) => r.productCode ?? "" },
    { label: "Sold", value: (r) => num(r.quantitySold), format: "number" },
    { label: "Cost of sales", value: (r) => num(r.value), format: "money" },
    { label: "Share", value: (r) => num(r.share), format: "percent" },
    { label: "Cumulative", value: (r) => (r.cumulativeShare == null ? "" : num(r.cumulativeShare)), format: "percent" },
    { label: "In stock (quantity)", value: (r) => num(r.stockQuantity), format: "number" },
    { label: "In stock (value)", value: (r) => num(r.stockValue), format: "money" },
  ];
  const totalsRow: Row | undefined = report
    ? { id: "totals", productId: 0, abcClass: "A", quantitySold: rows.reduce((s, r) => s + num(r.quantitySold), 0), value: report.total, share: 100, stockQuantity: rows.reduce((s, r) => s + num(r.stockQuantity), 0), stockValue: rows.reduce((s, r) => s + num(r.stockValue), 0) }
    : undefined;
  const card = (c: string, tone: "green" | "cyan" | "slate" | "red", hint: string) => (
    <TotalCard
      label={c === "NONE" ? "No sales" : `${t("Class")} ${c}`}
      tone={tone}
      value={c === "NONE" ? money(classes[c]?.stockValue) : money(classes[c]?.value)}
      hint={`${count(classes[c]?.products, "product", "products")} · ${c === "NONE" ? t("held in stock") : `${pct(classes[c]?.share)} · ${t(hint)}`}`}
    />
  );

  return (
    <>
      <PageMeta title={t("ABC Analysis")} description="Products ranked by what their sales cost" />
      <PageBreadcrumb pageTitle="ABC Analysis" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "ABC Analysis", period, columns: exportColumns, rows, totals: totalsRow }} />}>
          <PeriodPicker value={period} onChange={setPeriod} />
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {card("A", "green", "the first 80%")}
          {card("B", "cyan", "the next 15%")}
          {card("C", "slate", "the last 5%")}
          {card("NONE", "red", "")}
        </div>

        <p className="text-xs text-slate-500">
          {t("Products ranked by the cost of what they sold in the period (sales at cost, less customer returns). Class A makes up the first 80% of that, B the next 15%, C the rest. Products held in stock that didn't sell are listed last.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["productName", "productCode"]}
          searchPlaceholder={t("Search products")}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ChartPieIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default AbcAnalysis;
