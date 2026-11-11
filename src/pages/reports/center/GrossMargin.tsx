import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { ChartBarIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { INVOICE_API, apiError, money, monthLabel } from "../../Invoice/invoiceShared";
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
  initialPeriod,
  count,
  num,
  useSalesFilterOptions,
  useSyncedParams,
} from "./reportKit";
import { t } from "../../../i18n/i18n";

type GroupBy = "PRODUCT" | "CUSTOMER" | "CATEGORY" | "SALES_PERSON" | "MONTH";

const GROUPS: { value: GroupBy; label: string; column: string }[] = [
  { value: "PRODUCT", label: "By product", column: "Product" },
  { value: "CUSTOMER", label: "By customer", column: "Customer" },
  { value: "CATEGORY", label: "By category", column: "Category" },
  { value: "SALES_PERSON", label: "By sales person", column: "Sales person" },
  { value: "MONTH", label: "By month", column: "Month" },
];

interface MarginRow {
  key: string;
  code?: string | null;
  label: string;
  quantity?: number | null;
  netSales: number;
  costedSales: number;
  cost: number;
  margin: number;
  marginPercent?: number | null;
  uncostedSales: number;
  share: number;
}

interface MarginTotals {
  netSales: number;
  costedSales: number;
  cost: number;
  margin: number;
  marginPercent?: number | null;
  uncostedSales: number;
  serviceSales: number;
  quantity: number;
  invoices: number;
  creditNotes: number;
}

interface GrossMarginReport {
  rows: MarginRow[];
  totals: MarginTotals;
  warnings?: string[];
}

type Row = MarginRow & { id: string };

// Shows what goods cost: a finance report (INVOICE), unlike the other sales reports
const MODULES = ["INVOICE"];
const idOf = (key: string, prefix: string) => (key.startsWith(prefix) && /^\d+$/.test(key.slice(1)) ? key.slice(1) : null);
const percent = (value?: number | null) =>
  value === null || value === undefined ? "—" : `${num(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

/**
 * Gross margin (backlog 8.2.1.3): net sales less what the goods cost when their dispatch took them out of stock, by
 * product, customer, category, sales person or month. Sales without a known cost are kept out of the margin and shown.
 */
const GrossMargin: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => GROUPS.find((g) => g.value === params.get("groupBy"))?.value ?? "PRODUCT");
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [salesPersonId, setSalesPersonId] = useState(params.get("salesPersonId") ?? "");
  const [product, setProduct] = useState<{ id: string; label: string } | null>(() =>
    params.get("productId") ? { id: params.get("productId") as string, label: params.get("productName") ?? `#${params.get("productId")}` } : null
  );
  const [category, setCategory] = useState<{ id: string; label: string } | null>(() =>
    params.get("categoryId") ? { id: params.get("categoryId") as string, label: params.get("categoryName") ?? `#${params.get("categoryId")}` } : null
  );
  const [report, setReport] = useState<GrossMarginReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers, salesPersons } = useSalesFilterOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<GrossMarginReport>(`${INVOICE_API}/reports/margin`, {
        params: {
          from: period.from,
          to: period.to,
          groupBy,
          customerId: customerId || undefined,
          salesPersonId: salesPersonId || undefined,
          productId: product?.id,
          categoryId: category?.id,
        },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the gross margin"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, groupBy, customerId, salesPersonId, product?.id, category?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, {
    from: period.from,
    to: period.to,
    groupBy,
    customerId,
    salesPersonId,
    productId: product?.id,
    productName: product?.label,
    categoryId: category?.id,
    categoryName: category?.label,
  });

  const group = GROUPS.find((g) => g.value === groupBy) ?? GROUPS[0];
  // Only the service's own labels (keys ending in "-") are translated, never a customer's or product's name
  const label = (r: MarginRow) => (groupBy === "MONTH" ? monthLabel(r.label) : r.key.endsWith("-") ? t(r.label) : r.label);
  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.key })), [report]);
  const totals = report?.totals;
  const hasUncosted = rows.some((r) => num(r.uncostedSales) !== 0);

  // Clicking a row looks closer on this page: a product shows who bought it, a category its products, a customer what they
  // bought, a sales person their customers
  const open = (row: MarginRow) => {
    const productId = idOf(row.key, "P");
    const categoryId = idOf(row.key, "G");
    const customer = idOf(row.key, "C");
    const person = idOf(row.key, "S");
    if (groupBy === "PRODUCT" && productId) {
      setProduct({ id: productId, label: row.label });
      setGroupBy("CUSTOMER");
    } else if (groupBy === "CATEGORY" && categoryId) {
      setCategory({ id: categoryId, label: row.label });
      setGroupBy("PRODUCT");
    } else if (groupBy === "CUSTOMER" && customer) {
      setCustomerId(customer);
      setGroupBy("PRODUCT");
    } else if (groupBy === "SALES_PERSON" && person) {
      setSalesPersonId(person);
      setGroupBy("CUSTOMER");
    }
  };

  const moneyColumn = (key: "netSales" | "cost" | "margin" | "uncostedSales", text: string): ColumnDef<Row> => ({
    key,
    label: text,
    sortable: true,
    headerClassName: "text-right",
    className: "text-right",
    sortValueGetter: (r) => num(r[key]),
    render: (r) => (
      <span
        className={`text-sm ${
          key === "margin" ? (num(r.margin) < 0 ? "font-semibold text-red-600" : "font-semibold text-slate-900") : key === "uncostedSales" && num(r[key]) !== 0 ? "text-amber-700" : "text-slate-700"
        }`}
      >
        {money(r[key])}
      </span>
    ),
  });

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
    moneyColumn("netSales", "Net sales"),
    moneyColumn("cost", "Cost of goods"),
    moneyColumn("margin", "Gross margin"),
    {
      key: "marginPercent",
      label: "Gross margin %",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => (r.marginPercent === null || r.marginPercent === undefined ? -Infinity : num(r.marginPercent)),
      render: (r) => <span className={`text-sm ${num(r.marginPercent) < 0 ? "text-red-600" : "text-slate-700"}`}>{percent(r.marginPercent)}</span>,
    },
    ...(hasUncosted ? [moneyColumn("uncostedSales", "Without a cost")] : []),
    {
      key: "share",
      label: "Share of margin",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.share),
      render: (r) => <span className="text-sm text-slate-600">{percent(r.share)}</span>,
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: group.column, value: (r) => (r.key === "totals" ? r.label : label(r)) },
    { label: "Code", value: (r) => r.code ?? "" },
    ...(groupBy === "PRODUCT" ? [{ label: "Quantity", value: (r: Row) => num(r.quantity), format: "number" } as ReportColumn<Row>] : []),
    { label: "Net sales", value: (r) => num(r.netSales), format: "money" },
    { label: "Cost of goods", value: (r) => num(r.cost), format: "money" },
    { label: "Gross margin", value: (r) => num(r.margin), format: "money" },
    { label: "Gross margin %", value: (r) => (r.marginPercent === null || r.marginPercent === undefined ? "" : num(r.marginPercent)), format: "percent" },
    { label: "Without a cost", value: (r) => num(r.uncostedSales), format: "money" },
    { label: "Share of margin", value: (r) => num(r.share), format: "percent" },
  ];
  const totalsRow: Row | undefined = totals
    ? {
        id: "totals",
        key: "totals",
        label: t("Total"),
        quantity: groupBy === "PRODUCT" ? totals.quantity : null,
        netSales: totals.netSales,
        costedSales: totals.costedSales,
        cost: totals.cost,
        margin: totals.margin,
        marginPercent: totals.marginPercent,
        uncostedSales: totals.uncostedSales,
        share: num(totals.margin) === 0 ? 0 : 100,
      }
    : undefined;
  const details = [
    { label: "Grouped", value: t(group.label) },
    ...(customerId ? [{ label: "Customer", value: customers.find((c) => c.value === customerId)?.label ?? `#${customerId}` }] : []),
    ...(salesPersonId ? [{ label: "Sales person", value: salesPersons.find((p) => p.value === salesPersonId)?.label ?? `#${salesPersonId}` }] : []),
    ...(product ? [{ label: "Product", value: product.label }] : []),
    ...(category ? [{ label: "Category", value: category.label }] : []),
  ];

  const chart = useMemo(() => {
    const source = groupBy === "MONTH" ? rows : rows.slice(0, 10);
    return source.map((r) => ({ key: r.key, label: label(r), value: num(r.margin), display: `${money(r.margin)} · ${percent(r.marginPercent)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy]);

  const chip = (text: string, clear: () => void) => (
    <span className="inline-flex h-10 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-sm text-cyan-800">
      {text}
      <button type="button" aria-label={t("Remove filter")} className="rounded p-0.5 hover:bg-cyan-100" onClick={clear}>
        <XMarkIcon className="h-4 w-4" />
      </button>
    </span>
  );

  return (
    <>
      <PageMeta title={t("Gross Margin")} description="Net sales less the cost of the goods sold" />
      <PageBreadcrumb pageTitle="Gross Margin" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons
              modules={MODULES}
              disabled={loading || rows.length === 0}
              report={{ title: "Gross Margin", period, columns: exportColumns, rows, totals: totalsRow, details }}
            />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {customers.length > 0 && <SelectField label="Customer" value={customerId} options={customers} allLabel="All customers" onChange={setCustomerId} />}
          {salesPersons.length > 0 && (
            <SelectField label="Sales person" value={salesPersonId} options={salesPersons} allLabel="All sales persons" onChange={setSalesPersonId} />
          )}
          {product && chip(`${t("Product")}: ${product.label}`, () => setProduct(null))}
          {category && chip(`${t("Category")}: ${category.label}`, () => setCategory(null))}
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

        <ReportWarnings warnings={report?.warnings} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Net sales" tone="cyan" value={money(totals?.netSales)} hint={count(totals?.invoices, "invoice", "invoices")} />
          <TotalCard label="Cost of goods" tone="red" value={money(totals?.cost)} hint={t("At cost when dispatched, less returns")} />
          <TotalCard label="Gross margin" tone="green" value={money(totals?.margin)} hint={`${t("Gross margin %")} ${percent(totals?.marginPercent)}`} />
          <TotalCard
            label="Without a cost"
            value={money(totals?.uncostedSales)}
            hint={num(totals?.serviceSales) !== 0 ? `${t("Services")} ${money(totals?.serviceSales)}` : t("Left out of the margin")}
          />
        </div>

        <BarList title={groupBy === "MONTH" ? "Gross margin by month" : "Top 10 by gross margin"} rows={chart} empty={loading ? "Loading…" : "Nothing in this period"} />

        <p className="text-xs text-slate-500">
          {t("Click a row to look closer: a product shows who bought it, a category its products, a customer what they bought, a sales person their customers.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          onRowClick={open}
          defaultSortKey={groupBy === "MONTH" ? "label" : "margin"}
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

export default GrossMargin;
