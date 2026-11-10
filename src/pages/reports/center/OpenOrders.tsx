import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
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

interface PendingLine {
  productId?: number | null;
  productCode?: string | null;
  productName?: string | null;
  uom?: string | null;
  ordered: number;
  delivered: number;
  pending: number;
  pendingValue?: number | null;
}

interface OpenOrderRow {
  orderId: number;
  orderNumber?: string | null;
  orderDate?: string | null;
  status?: string | null;
  customerId?: number | null;
  customerCode?: string | null;
  customerName?: string | null;
  salesPersonName?: string | null;
  expectedDeliveryDate?: string | null;
  daysLate: number;
  creditHold: boolean;
  currency?: string | null;
  pendingDocumentValue?: number | null;
  orderedValue?: number | null;
  pendingValue?: number | null;
  lines: PendingLine[];
}

interface ProductBacklog {
  key: string;
  code?: string | null;
  name?: string | null;
  uom?: string | null;
  pendingQuantity: number;
  pendingValue: number;
  orders: number;
}

interface OpenOrders {
  asOf: string;
  rows: OpenOrderRow[];
  products: ProductBacklog[];
  totals: { orders: number; orderedValue: number; pendingValue: number; overdueOrders: number; overdueValue: number; onCreditHold: number };
  warnings?: string[];
  missingRates?: string[];
}

type Row = OpenOrderRow & { id: string };

const MODULES = ["SALES", "INVOICE"];
const API = "/v1/api/sales/report-center/open-orders";

/** "Steel bolts 2 of 4 · Hex nuts 6 of 6": what each order still has to deliver. */
const linesText = (lines: PendingLine[]) =>
  lines.map((l) => `${l.productName ?? l.productCode ?? "—"} ${num(l.pending).toLocaleString()} ${t("of")} ${num(l.ordered).toLocaleString()}`).join(" · ");

/** Sales orders with something still to deliver now (backlog 8.2.1.2), valued before tax at the orders' prices. */
const OpenOrdersReport: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "all"));
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [salesPersonId, setSalesPersonId] = useState(params.get("salesPersonId") ?? "");
  const [report, setReport] = useState<OpenOrders | null>(null);
  const [loading, setLoading] = useState(false);
  const { customers, salesPersons } = useSalesFilterOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<OpenOrders>(API, {
        params: {
          from: period.from || undefined,
          to: period.to || undefined,
          customerId: customerId || undefined,
          salesPersonId: salesPersonId || undefined,
        },
        // A 403 is a missing report right, not an expired login
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the open orders"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, customerId, salesPersonId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, customerId, salesPersonId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: String(r.orderId) })), [report]);
  const totals = report?.totals;
  const chart = useMemo(
    () =>
      (report?.products ?? []).slice(0, 10).map((p) => ({
        key: p.key,
        label: `${p.name ?? p.code ?? "—"} (${num(p.pendingQuantity).toLocaleString()})`,
        value: num(p.pendingValue),
        display: money(p.pendingValue),
      })),
    [report]
  );

  const columns: ColumnDef<Row>[] = [
    {
      key: "orderNumber",
      label: "Order",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.orderNumber ?? "—"}</span>
          <span className="block text-xs text-slate-500">
            {labelOf(r.status)}
            {r.creditHold ? ` · ${t("On credit hold")}` : ""}
          </span>
        </span>
      ),
    },
    { key: "orderDate", label: "Order date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.orderDate)}</span> },
    { key: "customerName", label: "Customer", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.customerName ?? r.customerCode ?? "—"}</span> },
    { key: "salesPersonName", label: "Sales person", sortable: true, render: (r) => <span className="text-sm text-slate-600">{r.salesPersonName ?? "—"}</span> },
    {
      key: "expectedDeliveryDate",
      label: "Expected delivery",
      sortable: true,
      sortValueGetter: (r) => r.daysLate,
      render: (r) => (
        <span className="text-sm">
          <span className="text-slate-700">{r.expectedDeliveryDate ? dateLabel(r.expectedDeliveryDate) : "—"}</span>
          {r.daysLate > 0 && <span className="block text-xs font-medium text-red-600">{count(r.daysLate, "day late", "days late")}</span>}
        </span>
      ),
    },
    {
      key: "lines",
      label: "Still to deliver",
      render: (r) => (
        <span className="block max-w-xs truncate text-sm text-slate-600" title={linesText(r.lines)}>
          {linesText(r.lines)}
        </span>
      ),
    },
    {
      key: "pendingValue",
      label: "Pending value",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.pendingValue),
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.pendingValue == null ? "—" : money(r.pendingValue)}</span>
          {r.currency && r.pendingValue !== r.pendingDocumentValue && (
            <span className="block text-xs text-slate-500">{money(r.pendingDocumentValue, r.currency)}</span>
          )}
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Order", value: (r) => r.orderNumber ?? "" },
    { label: "Order date", value: (r) => (r.orderDate ? dateLabel(r.orderDate) : "") },
    { label: "Status", value: (r) => (r.status ? labelOf(r.status) : "") },
    { label: "Customer", value: (r) => r.customerName ?? r.customerCode ?? "" },
    { label: "Sales person", value: (r) => r.salesPersonName ?? "" },
    { label: "Expected delivery", value: (r) => (r.expectedDeliveryDate ? dateLabel(r.expectedDeliveryDate) : "") },
    { label: "Days late", value: (r) => (r.id === "totals" ? "" : r.daysLate), format: "number" },
    { label: "Still to deliver", value: (r) => linesText(r.lines) },
    { label: "Ordered value", value: (r) => num(r.orderedValue), format: "money" },
    { label: "Pending value", value: (r) => num(r.pendingValue), format: "money" },
  ];
  const totalsRow = totals
    ? ({ id: "totals", orderId: 0, orderNumber: t("Total"), daysLate: 0, creditHold: false, lines: [], orderedValue: totals.orderedValue, pendingValue: totals.pendingValue } as Row)
    : undefined;
  const details = [
    ...(customerId ? [{ label: "Customer", value: customers.find((c) => c.value === customerId)?.label ?? `#${customerId}` }] : []),
    ...(salesPersonId ? [{ label: "Sales person", value: salesPersons.find((p) => p.value === salesPersonId)?.label ?? `#${salesPersonId}` }] : []),
  ];

  return (
    <>
      <PageMeta title={t("Open Orders")} description="Sales orders with something still to deliver" />
      <PageBreadcrumb pageTitle="Open Orders" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons
              modules={MODULES}
              disabled={loading || rows.length === 0}
              report={{ title: "Open Orders", period, columns: exportColumns, rows, totals: totalsRow, details }}
            />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} allowAll label="Order date" />
          {customers.length > 0 && <SelectField label="Customer" value={customerId} options={customers} allLabel="All customers" onChange={setCustomerId} />}
          {salesPersons.length > 0 && (
            <SelectField label="Sales person" value={salesPersonId} options={salesPersons} allLabel="All sales persons" onChange={setSalesPersonId} />
          )}
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard
            label="Open orders"
            tone="cyan"
            value={String(totals?.orders ?? 0)}
            hint={totals?.onCreditHold ? count(totals.onCreditHold, "on credit hold", "on credit hold") : undefined}
          />
          <TotalCard label="Still to deliver" tone="green" value={money(totals?.pendingValue)} hint={t("Before tax")} />
          <TotalCard label="Late" tone="red" value={money(totals?.overdueValue)} hint={count(totals?.overdueOrders, "order past its date", "orders past their date")} />
          <TotalCard label="Ordered value" value={money(totals?.orderedValue)} hint={t("The open orders in full")} />
        </div>

        <BarList title="Still to deliver by product" rows={chart} empty={loading ? "Loading…" : "Nothing to deliver"} />

        <p className="text-xs text-slate-500">
          {t("Confirmed orders with lines still to deliver, latest first by days late. Values are before tax, in the company currency; drafts, cancelled orders and orders closed short are left out.")}{" "}
          <Link to="/sales-orders" className="font-medium text-cyan-700 hover:underline">
            {t("Sales Orders")}
          </Link>
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["orderNumber", "customerName", "salesPersonName"]}
          searchPlaceholder={t("Search orders or customers")}
          defaultSortKey="expectedDeliveryDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ClipboardDocumentListIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing to deliver")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default OpenOrdersReport;
