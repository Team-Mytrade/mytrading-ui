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
  useSyncedParams,
  useVendorOptions,
} from "./reportKit";
import { t } from "../../../i18n/i18n";

interface PendingLine {
  productId?: number | null;
  productCode?: string | null;
  productName?: string | null;
  ordered: number;
  received: number;
  pending: number;
  pendingValue?: number | null;
}

interface OpenOrderRow {
  purchaseOrderId: number;
  poNumber?: string | null;
  orderDate?: string | null;
  expectedDeliveryDate?: string | null;
  daysLate: number;
  status?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  currency?: string | null;
  documentPending?: number | null;
  orderedValue?: number | null;
  pendingValue?: number | null;
  lines: PendingLine[];
}

interface OpenOrders {
  rows: OpenOrderRow[];
  byProduct: { productId?: number | null; productCode?: string | null; productName?: string | null; pending: number; pendingValue: number; orders: number }[];
  totals: { orders: number; late: number; orderedValue: number; pendingValue: number; pendingUnits: number };
  warnings?: string[];
  missingRates?: string[];
}

type Row = OpenOrderRow & { id: string };

const MODULES = ["PURCHASE", "INVOICE"];
const API = "/v1/api/purchase/report-center/open-orders";

/** "Hex nuts 10 of 20 · …": what each order still has to receive. */
const linesText = (lines: PendingLine[]) =>
  lines.map((l) => `${l.productName ?? l.productCode ?? "—"} ${num(l.pending).toLocaleString()} ${t("of")} ${num(l.ordered).toLocaleString()}`).join(" · ");

/** Approved or sent purchase orders with something still to receive (backlog 8.2.1.4), valued before tax. */
const OpenPurchaseOrders: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "all"));
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [report, setReport] = useState<OpenOrders | null>(null);
  const [loading, setLoading] = useState(false);
  const vendors = useVendorOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<OpenOrders>(API, {
        params: { from: period.from || undefined, to: period.to || undefined, vendorId: vendorId || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the open purchase orders"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, vendorId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: String(r.purchaseOrderId) })), [report]);
  const totals = report?.totals;
  const chart = useMemo(
    () =>
      (report?.byProduct ?? []).slice(0, 10).map((p, i) => ({
        key: String(p.productId ?? i),
        label: `${p.productName ?? p.productCode ?? "—"} (${num(p.pending).toLocaleString()})`,
        value: num(p.pendingValue),
        display: money(p.pendingValue),
      })),
    [report]
  );

  const columns: ColumnDef<Row>[] = [
    {
      key: "poNumber",
      label: "Purchase order",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.poNumber ?? "—"}</span>
          <span className="block text-xs text-slate-500">{labelOf(r.status)}</span>
        </span>
      ),
    },
    { key: "orderDate", label: "Order date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.orderDate)}</span> },
    { key: "vendorName", label: "Vendor", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.vendorName ?? r.vendorCode ?? "—"}</span> },
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
      label: "Still to receive",
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
          {r.currency && num(r.pendingValue) !== num(r.documentPending) && <span className="block text-xs text-slate-500">{money(r.documentPending, r.currency)}</span>}
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Purchase order", value: (r) => r.poNumber ?? "" },
    { label: "Order date", value: (r) => (r.orderDate ? dateLabel(r.orderDate) : "") },
    { label: "Status", value: (r) => (r.status ? labelOf(r.status) : "") },
    { label: "Vendor", value: (r) => r.vendorName ?? r.vendorCode ?? "" },
    { label: "Expected delivery", value: (r) => (r.expectedDeliveryDate ? dateLabel(r.expectedDeliveryDate) : "") },
    { label: "Days late", value: (r) => (r.id === "totals" ? "" : r.daysLate), format: "number" },
    { label: "Still to receive", value: (r) => linesText(r.lines) },
    { label: "Ordered value", value: (r) => num(r.orderedValue), format: "money" },
    { label: "Pending value", value: (r) => num(r.pendingValue), format: "money" },
  ];
  const totalsRow = totals
    ? ({ id: "totals", purchaseOrderId: 0, poNumber: t("Total"), daysLate: 0, lines: [], orderedValue: totals.orderedValue, pendingValue: totals.pendingValue } as Row)
    : undefined;
  const details = vendorId ? [{ label: "Vendor", value: vendors.find((v) => v.value === vendorId)?.label ?? `#${vendorId}` }] : [];

  return (
    <>
      <PageMeta title={t("Open Purchase Orders")} description="Purchase orders with something still to receive" />
      <PageBreadcrumb pageTitle="Open Purchase Orders" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Open Purchase Orders", period, columns: exportColumns, rows, totals: totalsRow, details }} />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} allowAll label="Order date" />
          {vendors.length > 0 && <SelectField label="Vendor" value={vendorId} options={vendors} allLabel="All vendors" onChange={setVendorId} />}
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Open orders" tone="cyan" value={String(totals?.orders ?? 0)} hint={count(totals?.pendingUnits, "unit to receive", "units to receive")} />
          <TotalCard label="Still to receive" tone="green" value={money(totals?.pendingValue)} hint={t("Before tax")} />
          <TotalCard label="Late" tone="red" value={String(totals?.late ?? 0)} hint={t("Orders past their expected delivery date")} />
          <TotalCard label="Ordered value" value={money(totals?.orderedValue)} hint={t("The open orders in full")} />
        </div>

        <BarList title="Still to receive by product" rows={chart} empty={loading ? "Loading…" : "Nothing to receive"} />

        <p className="text-xs text-slate-500">
          {t("Approved, sent and partly received orders with quantity not yet accepted on a goods receipt, most days late first. Values are before tax, in the company currency; drafts, cancelled orders and orders closed short are left out.")}{" "}
          <Link to="/purchase-service/orders" className="font-medium text-cyan-700 hover:underline">
            {t("Purchase Orders")}
          </Link>
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["poNumber", "vendorName"]}
          searchPlaceholder={t("Search orders or vendors")}
          defaultSortKey="expectedDeliveryDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ClipboardDocumentListIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing to receive")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default OpenPurchaseOrders;
