import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { DocumentCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, money, monthLabel } from "../../Invoice/invoiceShared";
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

type GroupBy = "SALES_PERSON" | "CUSTOMER" | "MONTH";
type Outcome = "DRAFT" | "OPEN" | "ACCEPTED" | "CONVERTED" | "REJECTED" | "EXPIRED";

const GROUPS: { value: GroupBy; label: string; column: string }[] = [
  { value: "SALES_PERSON", label: "By sales person", column: "Sales person" },
  { value: "CUSTOMER", label: "By customer", column: "Customer" },
  { value: "MONTH", label: "By month", column: "Month" },
];

const OUTCOMES: Record<Outcome, { label: string; tone: string }> = {
  CONVERTED: { label: "Became an order", tone: "bg-green-50 text-green-700" },
  ACCEPTED: { label: "Accepted, no order yet", tone: "bg-cyan-50 text-cyan-700" },
  OPEN: { label: "Waiting for the customer", tone: "bg-slate-100 text-slate-700" },
  REJECTED: { label: "Refused", tone: "bg-red-50 text-red-700" },
  EXPIRED: { label: "Ran out", tone: "bg-amber-50 text-amber-700" },
  DRAFT: { label: "Not sent yet", tone: "bg-slate-50 text-slate-500" },
};

interface ConversionRow {
  key: string;
  label: string;
  quoted: number;
  quotedValue: number;
  converted: number;
  convertedValue: number;
  orderValue: number;
  accepted: number;
  open: number;
  rejected: number;
  expired: number;
  drafts: number;
  conversionRate: number;
  valueRate: number;
  averageDaysToOrder?: number | null;
}

interface QuoteRow {
  quotationId: number;
  number?: string | null;
  date?: string | null;
  validUntil?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  salesPersonId?: number | null;
  salesPersonName?: string | null;
  outcome: Outcome;
  currency?: string | null;
  documentValue?: number | null;
  value?: number | null;
  orderNumber?: string | null;
  daysToOrder?: number | null;
}

interface Conversion {
  rows: ConversionRow[];
  totals: ConversionRow;
  quotations: QuoteRow[];
  warnings?: string[];
  missingRates?: string[];
}

type GroupTableRow = ConversionRow & { id: string };
type QuoteTableRow = QuoteRow & { id: string };

const MODULES = ["SALES", "INVOICE"];
const API = "/v1/api/sales/report-center/quotation-conversion";
const pct = (value: number | null | undefined) => `${num(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

/** The quotations of a period and what each came to (backlog 8.2.1.2): the conversion rate by sales person, customer or month. */
const QuotationConversion: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => GROUPS.find((g) => g.value === params.get("groupBy"))?.value ?? "SALES_PERSON");
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [salesPersonId, setSalesPersonId] = useState(params.get("salesPersonId") ?? "");
  // A group clicked: the quotation list below shows only its quotations
  const [picked, setPicked] = useState<ConversionRow | null>(null);
  const [report, setReport] = useState<Conversion | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers, salesPersons } = useSalesFilterOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Conversion>(API, {
        params: { from: period.from, to: period.to, groupBy, customerId: customerId || undefined, salesPersonId: salesPersonId || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
      setPicked(null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the quotation conversion"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, groupBy, customerId, salesPersonId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, groupBy, customerId, salesPersonId });

  const group = GROUPS.find((g) => g.value === groupBy) ?? GROUPS[0];
  // Only the service's own label ("No sales person": key ending in "-") is translated, never a name
  const label = (r: ConversionRow) => (groupBy === "MONTH" ? monthLabel(r.label) : r.key.endsWith("-") ? t(r.label) : r.label);
  const groupRows: GroupTableRow[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.key })), [report]);
  const totals = report?.totals;

  // The quotations of the group picked (by the same key the service groups by)
  const inGroup = (q: QuoteRow, key: string) => {
    if (groupBy === "MONTH") return (q.date ?? "").startsWith(key);
    if (groupBy === "CUSTOMER") return key === `C${q.customerId ?? q.customerName}`;
    return key === "S-" ? q.salesPersonId == null && !q.salesPersonName : key === `S${q.salesPersonId ?? q.salesPersonName}`;
  };
  const quotes: QuoteTableRow[] = useMemo(
    () =>
      (report?.quotations ?? [])
        .filter((q) => !picked || inGroup(q, picked.key))
        .map((q) => ({ ...q, id: String(q.quotationId) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, picked]
  );

  const chart = useMemo(
    () =>
      (groupBy === "MONTH" ? groupRows : groupRows.slice(0, 10)).map((r) => ({ key: r.key, label: label(r), value: num(r.conversionRate), display: pct(r.conversionRate) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupRows, groupBy]
  );

  const number = (key: keyof ConversionRow, title: string): ColumnDef<GroupTableRow> => ({
    key,
    label: title,
    sortable: true,
    headerClassName: "text-right",
    className: "text-right",
    sortValueGetter: (r) => num(r[key] as number),
    render: (r) => <span className="text-sm text-slate-700">{num(r[key] as number).toLocaleString()}</span>,
  });

  const groupColumns: ColumnDef<GroupTableRow>[] = [
    {
      key: "label",
      label: group.column,
      sortable: true,
      sortValueGetter: (r) => (groupBy === "MONTH" ? r.key : label(r)),
      render: (r) => <span className="text-sm font-semibold text-slate-900">{label(r)}</span>,
    },
    number("quoted", "Sent"),
    {
      key: "quotedValue",
      label: "Value quoted",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.quotedValue),
      render: (r) => <span className="text-sm text-slate-700">{money(r.quotedValue)}</span>,
    },
    number("converted", "Became orders"),
    {
      key: "conversionRate",
      label: "Conversion",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.conversionRate),
      render: (r) => <span className="text-sm font-semibold text-slate-900">{pct(r.conversionRate)}</span>,
    },
    {
      key: "valueRate",
      label: "By value",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.valueRate),
      render: (r) => <span className="text-sm text-slate-700">{pct(r.valueRate)}</span>,
    },
    number("accepted", "Accepted"),
    number("open", "Open"),
    number("rejected", "Refused"),
    number("expired", "Ran out"),
    {
      key: "averageDaysToOrder",
      label: "Days to order",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.averageDaysToOrder),
      render: (r) => <span className="text-sm text-slate-600">{r.averageDaysToOrder == null ? "—" : num(r.averageDaysToOrder).toLocaleString()}</span>,
    },
  ];

  const quoteColumns: ColumnDef<QuoteTableRow>[] = [
    {
      key: "number",
      label: "Quotation",
      sortable: true,
      render: (r) => (
        <Link to={`/quote-view/${r.quotationId}`} className="text-sm font-semibold text-cyan-700 hover:underline">
          {r.number ?? "—"}
        </Link>
      ),
    },
    { key: "date", label: "Date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    { key: "customerName", label: "Customer", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.customerName ?? "—"}</span> },
    { key: "salesPersonName", label: "Sales person", sortable: true, render: (r) => <span className="text-sm text-slate-600">{r.salesPersonName ?? "—"}</span> },
    {
      key: "value",
      label: "Value",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.value),
      render: (r) => (
        <span className="text-sm">
          <span className="text-slate-800">{r.value == null ? "—" : money(r.value)}</span>
          {r.currency && r.value !== r.documentValue && <span className="block text-xs text-slate-500">{money(r.documentValue, r.currency)}</span>}
        </span>
      ),
    },
    {
      key: "outcome",
      label: "Outcome",
      sortable: true,
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOMES[r.outcome]?.tone ?? "bg-slate-100 text-slate-600"}`}>
          {t(OUTCOMES[r.outcome]?.label ?? r.outcome)}
          {r.orderNumber ? ` · ${r.orderNumber}` : ""}
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<GroupTableRow>[] = [
    { label: group.column, value: (r) => (r.key === "totals" ? t("Total") : label(r)) },
    { label: "Sent", value: (r) => r.quoted, format: "number" },
    { label: "Value quoted", value: (r) => num(r.quotedValue), format: "money" },
    { label: "Became orders", value: (r) => r.converted, format: "number" },
    { label: "Value converted", value: (r) => num(r.convertedValue), format: "money" },
    { label: "Conversion", value: (r) => num(r.conversionRate), format: "percent" },
    { label: "By value", value: (r) => num(r.valueRate), format: "percent" },
    { label: "Accepted", value: (r) => r.accepted, format: "number" },
    { label: "Open", value: (r) => r.open, format: "number" },
    { label: "Refused", value: (r) => r.rejected, format: "number" },
    { label: "Ran out", value: (r) => r.expired, format: "number" },
    { label: "Days to order", value: (r) => (r.averageDaysToOrder == null ? "" : num(r.averageDaysToOrder)), format: "number" },
  ];
  const totalsRow = totals ? ({ ...totals, id: "totals", key: "totals" } as GroupTableRow) : undefined;
  const details = [
    { label: "Grouped", value: t(group.label) },
    ...(customerId ? [{ label: "Customer", value: customers.find((c) => c.value === customerId)?.label ?? `#${customerId}` }] : []),
    ...(salesPersonId ? [{ label: "Sales person", value: salesPersons.find((p) => p.value === salesPersonId)?.label ?? `#${salesPersonId}` }] : []),
  ];

  return (
    <>
      <PageMeta title={t("Quotation Conversion")} description="Quotations of a period and what they came to" />
      <PageBreadcrumb pageTitle="Quotation Conversion" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons
              modules={MODULES}
              disabled={loading || groupRows.length === 0}
              report={{ title: "Quotation Conversion", period, columns: exportColumns, rows: groupRows, totals: totalsRow, details }}
            />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {customers.length > 0 && <SelectField label="Customer" value={customerId} options={customers} allLabel="All customers" onChange={setCustomerId} />}
          {salesPersons.length > 0 && (
            <SelectField label="Sales person" value={salesPersonId} options={salesPersons} allLabel="All sales persons" onChange={setSalesPersonId} />
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
          <TotalCard label="Conversion rate" tone="green" value={pct(totals?.conversionRate)} hint={`${pct(totals?.valueRate)} ${t("by value")}`} />
          <TotalCard label="Value quoted" tone="cyan" value={money(totals?.quotedValue)} hint={count(totals?.quoted, "quotation sent", "quotations sent")} />
          <TotalCard label="Became orders" value={money(totals?.convertedValue)} hint={count(totals?.converted, "quotation converted", "quotations converted")} />
          <TotalCard
            label="Lost"
            tone="red"
            value={String((totals?.rejected ?? 0) + (totals?.expired ?? 0))}
            hint={`${count(totals?.rejected, "refused", "refused")} · ${count(totals?.expired, "ran out", "ran out")}`}
          />
        </div>

        <BarList title={groupBy === "MONTH" ? "Conversion rate by month" : "Conversion rate"} rows={chart} empty={loading ? "Loading…" : "Nothing in this period"} />

        <p className="text-xs text-slate-500">
          {t("Quotations by their date. Drafts are not counted; a sent quotation past its valid-until date counts as run out. Values are before tax, in the company currency. Click a row to list its quotations.")}
          {totals && totals.drafts > 0 ? ` ${count(totals.drafts, "draft not counted", "drafts not counted")}.` : ""}
        </p>

        <ReusableTable
          data={groupRows}
          columns={groupColumns}
          pageSize={25}
          loading={loading}
          onRowClick={(row) => setPicked((current) => (current?.key === row.key ? null : row))}
          defaultSortKey={groupBy === "MONTH" ? "label" : "quotedValue"}
          defaultSortOrder={groupBy === "MONTH" ? "asc" : "desc"}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <DocumentCheckIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />

        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800">{t("Quotations")}</h2>
            {picked && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs text-cyan-800">
                {label(picked)}
                <button type="button" aria-label={t("Remove filter")} className="rounded p-0.5 hover:bg-cyan-100" onClick={() => setPicked(null)}>
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
          <ReusableTable
            data={quotes}
            columns={quoteColumns}
            pageSize={10}
            loading={loading}
            searchable
            searchFields={["number", "customerName", "salesPersonName", "orderNumber"]}
            searchPlaceholder={t("Search quotations or customers")}
            defaultSortKey="date"
            defaultSortOrder="desc"
            emptyState={<p className="py-6 text-center text-sm text-gray-500">{t("Nothing in this period")}</p>}
          />
        </section>
      </div>
    </>
  );
};

export default QuotationConversion;
