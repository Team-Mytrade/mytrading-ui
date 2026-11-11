import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ChartBarIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, money, monthLabel } from "../../Invoice/invoiceShared";
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

type GroupBy = "VENDOR" | "PRODUCT" | "MONTH";

const GROUPS: { value: GroupBy; label: string; column: string }[] = [
  { value: "VENDOR", label: "By vendor", column: "Vendor" },
  { value: "PRODUCT", label: "By product", column: "Product" },
  { value: "MONTH", label: "By month", column: "Month" },
];

interface AnalysisRow {
  key: string;
  code?: string | null;
  label: string;
  quantity?: number | null;
  received: number;
  returned: number;
  net: number;
  receipts: number;
  share: number;
}

interface Analysis {
  rows: AnalysisRow[];
  totals: { received: number; returned: number; net: number; quantity: number; receipts: number; returns: number; vendors: number };
  warnings?: string[];
  missingRates?: string[];
}

type Row = AnalysisRow & { id: string };

const MODULES = ["PURCHASE", "INVOICE"];
const API = "/v1/api/purchase/report-center/analysis";
const idOf = (key: string, prefix: string) => (key.startsWith(prefix) && /^\d+$/.test(key.slice(1)) ? key.slice(1) : null);

/** Goods received less goods sent back for a debit note (backlog 8.2.1.4), by vendor, product or month. */
const PurchaseAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => GROUPS.find((g) => g.value === params.get("groupBy"))?.value ?? "VENDOR");
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [product, setProduct] = useState<{ id: string; label: string } | null>(() =>
    params.get("productId") ? { id: params.get("productId") as string, label: params.get("productName") ?? `#${params.get("productId")}` } : null
  );
  const [report, setReport] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const vendors = useVendorOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Analysis>(API, {
        params: { from: period.from, to: period.to, groupBy, vendorId: vendorId || undefined, productId: product?.id },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the purchase analysis"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, groupBy, vendorId, product?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, groupBy, vendorId, productId: product?.id, productName: product?.label });

  const group = GROUPS.find((g) => g.value === groupBy) ?? GROUPS[0];
  const label = (r: AnalysisRow) => (groupBy === "MONTH" ? monthLabel(r.label) : r.key.endsWith("-") ? t(r.label) : r.label);
  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.key })), [report]);
  const totals = report?.totals;

  // A vendor shows what was bought from them, a product who it was bought from, a month its bills in the register
  const open = (row: AnalysisRow) => {
    const vendor = idOf(row.key, "V");
    const productId = idOf(row.key, "P");
    if (groupBy === "VENDOR" && vendor) {
      setVendorId(vendor);
      setGroupBy("PRODUCT");
    } else if (groupBy === "PRODUCT" && productId) {
      setProduct({ id: productId, label: row.label });
      setGroupBy("VENDOR");
    } else if (groupBy === "MONTH" && /^\d{4}-\d{2}$/.test(row.key)) {
      const [y, m] = row.key.split("-").map(Number);
      const from = `${row.key}-01` < period.from ? period.from : `${row.key}-01`;
      const last = `${row.key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      navigate(`/reports/purchase-register?${new URLSearchParams({ from, to: last > period.to ? period.to : last, ...(vendorId ? { vendorId } : {}) })}`);
    }
  };

  const columns: ColumnDef<Row>[] = [
    {
      key: "label",
      label: group.column,
      sortable: true,
      sortValueGetter: (r) => (groupBy === "MONTH" ? r.key : label(r)),
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{label(r)}</span>
          {r.code && <span className="block text-xs text-slate-500">{r.code}</span>}
        </span>
      ),
    },
    ...(groupBy === "PRODUCT"
      ? [
          {
            key: "quantity",
            label: "Quantity",
            sortable: true,
            headerClassName: "text-right",
            className: "text-right",
            sortValueGetter: (r: Row) => num(r.quantity),
            render: (r: Row) => <span className="text-sm text-slate-700">{num(r.quantity).toLocaleString()}</span>,
          } as ColumnDef<Row>,
        ]
      : []),
    ...(["received", "returned", "net"] as const).map(
      (key): ColumnDef<Row> => ({
        key,
        label: key === "received" ? "Received" : key === "returned" ? "Sent back" : "Net purchases",
        sortable: true,
        headerClassName: "text-right",
        className: "text-right",
        sortValueGetter: (r) => num(r[key]),
        render: (r) => (
          <span className={`text-sm ${key === "returned" && num(r[key]) !== 0 ? "text-red-600" : key === "net" ? "font-semibold text-slate-900" : "text-slate-700"}`}>
            {money(r[key])}
          </span>
        ),
      })
    ),
    {
      key: "share",
      label: "Share",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.share),
      render: (r) => <span className="text-sm text-slate-600">{num(r.share).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</span>,
    },
    { key: "receipts", label: "Receipts", sortable: true, headerClassName: "text-right", className: "text-right", render: (r) => <span className="text-sm text-slate-600">{r.receipts}</span> },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: group.column, value: (r) => (r.key === "totals" ? r.label : label(r)) },
    { label: "Code", value: (r) => r.code ?? "" },
    ...(groupBy === "PRODUCT" ? [{ label: "Quantity", value: (r: Row) => num(r.quantity), format: "number" } as ReportColumn<Row>] : []),
    { label: "Received", value: (r) => num(r.received), format: "money" },
    { label: "Sent back", value: (r) => num(r.returned), format: "money" },
    { label: "Net purchases", value: (r) => num(r.net), format: "money" },
    { label: "Share", value: (r) => num(r.share), format: "percent" },
    { label: "Receipts", value: (r) => r.receipts, format: "number" },
  ];
  const totalsRow: Row | undefined = totals
    ? {
        id: "totals",
        key: "totals",
        label: t("Total"),
        quantity: groupBy === "PRODUCT" ? totals.quantity : null,
        received: totals.received,
        returned: totals.returned,
        net: totals.net,
        receipts: totals.receipts,
        share: num(totals.net) === 0 ? 0 : 100,
      }
    : undefined;
  const details = [
    { label: "Grouped", value: t(group.label) },
    ...(vendorId ? [{ label: "Vendor", value: vendors.find((v) => v.value === vendorId)?.label ?? `#${vendorId}` }] : []),
    ...(product ? [{ label: "Product", value: product.label }] : []),
  ];

  const chart = useMemo(() => {
    const source = groupBy === "MONTH" ? rows : rows.slice(0, 10);
    return source.map((r) => ({ key: r.key, label: label(r), value: num(r.net), display: money(r.net) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy]);

  return (
    <>
      <PageMeta title={t("Purchase Analysis")} description="Goods received less goods sent back, by vendor, product or month" />
      <PageBreadcrumb pageTitle="Purchase Analysis" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Purchase Analysis", period, columns: exportColumns, rows, totals: totalsRow, details }} />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {vendors.length > 0 && <SelectField label="Vendor" value={vendorId} options={vendors} allLabel="All vendors" onChange={setVendorId} />}
          {product && (
            <span className="inline-flex h-10 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-sm text-cyan-800">
              {`${t("Product")}: ${product.label}`}
              <button type="button" aria-label={t("Remove filter")} className="rounded p-0.5 hover:bg-cyan-100" onClick={() => setProduct(null)}>
                <XMarkIcon className="h-4 w-4" />
              </button>
            </span>
          )}
        </FilterBar>

        <div className="flex flex-wrap gap-2" role="tablist">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              role="tab"
              aria-selected={g.value === groupBy}
              onClick={() => setGroupBy(g.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                g.value === groupBy ? "bg-cyan-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t(g.label)}
            </button>
          ))}
        </div>

        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Net purchases" tone="green" value={money(totals?.net)} hint={t("Before tax, after goods sent back")} />
          <TotalCard label="Received" tone="cyan" value={money(totals?.received)} hint={count(totals?.receipts, "goods receipt", "goods receipts")} />
          <TotalCard label="Sent back" tone="red" value={money(totals?.returned)} hint={count(totals?.returns, "return", "returns")} />
          <TotalCard label="Vendors" value={String(totals?.vendors ?? 0)} hint={t("Bought from in the period")} />
        </div>

        <BarList title={groupBy === "MONTH" ? "Net purchases by month" : "Top 10 by net purchases"} rows={chart} empty={loading ? "Loading…" : "Nothing in this period"} />

        <p className="text-xs text-slate-500">
          {t("Goods accepted on receipts in the period at the purchase order's price after discount, less goods sent back for a debit note. Click a row: a vendor shows what was bought from them, a product who it came from, a month its bills.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          onRowClick={open}
          defaultSortKey={groupBy === "MONTH" ? "label" : "net"}
          defaultSortOrder={groupBy === "MONTH" ? "asc" : "desc"}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ChartBarIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default PurchaseAnalysis;
