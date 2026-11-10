import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ChartBarIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
  SelectField,
  TotalCard,
  initialPeriod,
  count,
  num,
  useSalesFilterOptions,
  useSyncedParams,
} from "./reportKit";
import type { SalesTotals } from "./SalesRegister";
import { t } from "../../../i18n/i18n";

type GroupBy = "CUSTOMER" | "PRODUCT" | "CATEGORY" | "SALES_PERSON" | "MONTH";

const GROUPS: { value: GroupBy; label: string; column: string }[] = [
  { value: "CUSTOMER", label: "By customer", column: "Customer" },
  { value: "PRODUCT", label: "By product", column: "Product" },
  { value: "CATEGORY", label: "By category", column: "Category" },
  { value: "SALES_PERSON", label: "By sales person", column: "Sales person" },
  { value: "MONTH", label: "By month", column: "Month" },
];

interface AnalysisRow {
  key: string;
  code?: string | null;
  label: string;
  quantity?: number | null;
  invoiced: number;
  credited: number;
  net: number;
  tax: number;
  invoices: number;
  share: number;
}

interface Analysis {
  rows: AnalysisRow[];
  totals: SalesTotals;
  warnings?: string[];
}

type Row = AnalysisRow & { id: string };

const MODULES = ["SALES", "INVOICE"];
// The keys the service gives each group: C<customer id>, P<product id>, G<category id>, S<sales person id>, YYYY-MM
const idOf = (key: string, prefix: string) => (key.startsWith(prefix) && /^\d+$/.test(key.slice(1)) ? key.slice(1) : null);

/** Net sales grouped by customer, product, category, sales person or month (backlog 8.2.1), after credit notes. */
const SalesAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => GROUPS.find((g) => g.value === params.get("groupBy"))?.value ?? "CUSTOMER");
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [salesPersonId, setSalesPersonId] = useState(params.get("salesPersonId") ?? "");
  // Product and category filters come from clicking a row; their names are kept for the chip
  const [product, setProduct] = useState<{ id: string; label: string } | null>(() =>
    params.get("productId") ? { id: params.get("productId") as string, label: params.get("productName") ?? `#${params.get("productId")}` } : null
  );
  const [category, setCategory] = useState<{ id: string; label: string } | null>(() =>
    params.get("categoryId") ? { id: params.get("categoryId") as string, label: params.get("categoryName") ?? `#${params.get("categoryId")}` } : null
  );
  const [report, setReport] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers, salesPersons } = useSalesFilterOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Analysis>(`${INVOICE_API}/reports/sales/analysis`, {
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
      ToasterService.error(apiError(err, "Failed to load the sales analysis"));
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
  // Only the service's own labels ("No category", "No sales person", "Not by product": keys ending in "-") are translated,
  // never a customer's or product's name
  const label = (r: AnalysisRow) => (groupBy === "MONTH" ? monthLabel(r.label) : r.key.endsWith("-") ? t(r.label) : r.label);
  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.key })), [report]);
  const totals = report?.totals;

  // Clicking a row narrows the report: a customer, sales person or month opens its documents; a product shows who bought it;
  // a category shows its products
  const open = (row: AnalysisRow) => {
    const register = (extra: Record<string, string>, from = period.from, to = period.to) =>
      navigate(`/reports/sales-register?${new URLSearchParams({ from, to, ...extra })}`);
    const customer = idOf(row.key, "C");
    const person = idOf(row.key, "S");
    const productId = idOf(row.key, "P");
    const categoryId = idOf(row.key, "G");
    if (groupBy === "CUSTOMER" && customer) register({ customerId: customer, ...(salesPersonId ? { salesPersonId } : {}) });
    else if (groupBy === "SALES_PERSON" && person) register({ salesPersonId: person, ...(customerId ? { customerId } : {}) });
    else if (groupBy === "MONTH" && /^\d{4}-\d{2}$/.test(row.key)) {
      const [y, m] = row.key.split("-").map(Number);
      const from = `${row.key}-01` < period.from ? period.from : `${row.key}-01`;
      const last = `${row.key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      register({}, from, last > period.to ? period.to : last);
    } else if (groupBy === "PRODUCT" && productId) {
      setProduct({ id: productId, label: row.label });
      setGroupBy("CUSTOMER");
    } else if (groupBy === "CATEGORY" && categoryId) {
      setCategory({ id: categoryId, label: row.label });
      setGroupBy("PRODUCT");
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
    ...(["invoiced", "credited", "net"] as const).map(
      (key): ColumnDef<Row> => ({
        key,
        label: key === "invoiced" ? "Invoiced" : key === "credited" ? "Credit notes" : "Net sales",
        sortable: true,
        headerClassName: "text-right",
        className: "text-right",
        sortValueGetter: (r) => num(r[key]),
        render: (r) => (
          <span className={`text-sm ${key === "credited" && num(r[key]) !== 0 ? "text-red-600" : key === "net" ? "font-semibold text-slate-900" : "text-slate-700"}`}>
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
    { key: "invoices", label: "Invoices", sortable: true, headerClassName: "text-right", className: "text-right", render: (r) => <span className="text-sm text-slate-600">{r.invoices}</span> },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: group.column, value: (r) => (r.key === "totals" ? r.label : label(r)) },
    { label: "Code", value: (r) => r.code ?? "" },
    ...(groupBy === "PRODUCT" ? [{ label: "Quantity", value: (r: Row) => num(r.quantity), format: "number" } as ReportColumn<Row>] : []),
    { label: "Invoiced", value: (r) => num(r.invoiced), format: "money" },
    { label: "Credit notes", value: (r) => num(r.credited), format: "money" },
    { label: "Net sales", value: (r) => num(r.net), format: "money" },
    { label: "Tax", value: (r) => num(r.tax), format: "money" },
    { label: "Share", value: (r) => num(r.share), format: "percent" },
    { label: "Invoices", value: (r) => r.invoices, format: "number" },
  ];
  const totalsRow: Row | undefined = totals
    ? {
        id: "totals",
        key: "totals",
        label: t("Total"),
        quantity: groupBy === "PRODUCT" ? totals.quantity : null,
        invoiced: totals.invoiced,
        credited: totals.credited,
        net: totals.net,
        tax: totals.tax,
        invoices: totals.invoices,
        share: num(totals.net) === 0 ? 0 : 100,
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
    return source.map((r) => ({ key: r.key, label: label(r), value: num(r.net), display: money(r.net) }));
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
      <PageMeta title={t("Sales Analysis")} description="Net sales by customer, product, category, sales person or month" />
      <PageBreadcrumb pageTitle="Sales Analysis" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons
              modules={MODULES}
              disabled={loading || rows.length === 0}
              report={{ title: "Sales Analysis", period, columns: exportColumns, rows, totals: totalsRow, details }}
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

        {(report?.warnings ?? []).map((w) => (
          <p key={w} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
            {t(w)}
          </p>
        ))}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Net sales" tone="green" value={money(totals?.net)} hint={t("Before tax, after credit notes")} />
          <TotalCard label="Invoiced" tone="cyan" value={money(totals?.invoiced)} hint={count(totals?.invoices, "invoice", "invoices")} />
          <TotalCard label="Credit notes" tone="red" value={money(totals?.credited)} hint={count(totals?.creditNotes, "credit note", "credit notes")} />
          <TotalCard label="Tax" value={money(totals?.tax)} hint={`${t("Total with tax")} ${money(totals?.total)}`} />
        </div>

        <BarList title={groupBy === "MONTH" ? "Net sales by month" : "Top 10 by net sales"} rows={chart} empty={loading ? "Loading…" : "Nothing in this period"} />

        <p className="text-xs text-slate-500">
          {t("Click a row to look closer: a customer, sales person or month opens its documents in the Sales Register; a product shows who bought it; a category shows its products.")}
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

export default SalesAnalysis;
