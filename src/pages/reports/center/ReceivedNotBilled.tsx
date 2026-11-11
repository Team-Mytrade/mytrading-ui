import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { InboxArrowDownIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import {
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

interface UnbilledRow {
  grnId: number;
  grnNumber?: string | null;
  receiptDate?: string | null;
  daysWaiting: number;
  poNumber?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  currency?: string | null;
  documentTotal?: number | null;
  net?: number | null;
  tax?: number | null;
  total?: number | null;
}

interface Unbilled {
  rows: UnbilledRow[];
  totals: { receipts: number; net: number; tax: number; total: number; overAMonth: number; oldestDays: number };
  warnings?: string[];
  missingRates?: string[];
}

type Row = UnbilledRow & { id: string };

const MODULES = ["PURCHASE", "INVOICE"];
const API = "/v1/api/purchase/report-center/received-not-billed";

/** Accepted goods receipts no vendor bill covers yet (backlog 8.2.1.4): the "goods received, not billed" balance. */
const ReceivedNotBilled: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "all"));
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [report, setReport] = useState<Unbilled | null>(null);
  const [loading, setLoading] = useState(false);
  const vendors = useVendorOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Unbilled>(API, {
        params: { from: period.from || undefined, to: period.to || undefined, vendorId: vendorId || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the goods received not billed"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, vendorId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: String(r.grnId) })), [report]);
  const totals = report?.totals;

  const columns: ColumnDef<Row>[] = [
    {
      key: "grnNumber",
      label: "Goods receipt",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.grnNumber ?? "—"}</span>
          {r.poNumber && <span className="block text-xs text-slate-500">{r.poNumber}</span>}
        </span>
      ),
    },
    { key: "receiptDate", label: "Received", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.receiptDate)}</span> },
    {
      key: "daysWaiting",
      label: "Waiting",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (r) => <span className={`text-sm ${r.daysWaiting > 30 ? "font-semibold text-red-600" : "text-slate-700"}`}>{count(r.daysWaiting, "day", "days")}</span>,
    },
    { key: "vendorName", label: "Vendor", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.vendorName ?? r.vendorCode ?? "—"}</span> },
    {
      key: "net",
      label: "Net",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.net),
      render: (r) => (
        <span className="text-sm">
          <span className="text-slate-800">{r.net == null ? "—" : money(r.net)}</span>
          {r.currency && r.total != null && num(r.documentTotal) !== num(r.total) && <span className="block text-xs text-slate-500">{money(r.documentTotal, r.currency)}</span>}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.total),
      render: (r) => <span className="text-sm font-semibold text-slate-900">{r.total == null ? "—" : money(r.total)}</span>,
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Goods receipt", value: (r) => r.grnNumber ?? "" },
    { label: "Purchase order", value: (r) => r.poNumber ?? "" },
    { label: "Received", value: (r) => (r.receiptDate ? dateLabel(r.receiptDate) : "") },
    { label: "Days waiting", value: (r) => (r.id === "totals" ? "" : r.daysWaiting), format: "number" },
    { label: "Vendor", value: (r) => r.vendorName ?? r.vendorCode ?? "" },
    { label: "Net", value: (r) => num(r.net), format: "money" },
    { label: "Tax", value: (r) => num(r.tax), format: "money" },
    { label: "Total", value: (r) => num(r.total), format: "money" },
  ];
  const totalsRow = totals ? ({ id: "totals", grnId: 0, grnNumber: t("Total"), daysWaiting: 0, net: totals.net, tax: totals.tax, total: totals.total } as Row) : undefined;
  const details = vendorId ? [{ label: "Vendor", value: vendors.find((v) => v.value === vendorId)?.label ?? `#${vendorId}` }] : [];

  return (
    <>
      <PageMeta title={t("Goods Received Not Billed")} description="Accepted goods receipts no vendor bill covers yet" />
      <PageBreadcrumb pageTitle="Goods Received Not Billed" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Goods Received Not Billed", period, columns: exportColumns, rows, totals: totalsRow, details }} />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} allowAll label="Receipt date" />
          {vendors.length > 0 && <SelectField label="Vendor" value={vendorId} options={vendors} allLabel="All vendors" onChange={setVendorId} />}
        </FilterBar>

        <ReportWarnings warnings={report?.warnings} missingRates={report?.missingRates} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Waiting for a bill" tone="cyan" value={money(totals?.total)} hint={count(totals?.receipts, "goods receipt", "goods receipts")} />
          <TotalCard label="Before tax" tone="green" value={money(totals?.net)} hint={`${t("Tax")} ${money(totals?.tax)}`} />
          <TotalCard label="Over a month" tone="red" value={String(totals?.overAMonth ?? 0)} hint={count(totals?.oldestDays, "day for the oldest", "days for the oldest")} />
          <TotalCard label="Vendors" value={String(new Set(rows.map((r) => r.vendorName ?? r.vendorCode)).size)} hint={t("With goods to bill")} />
        </div>

        <p className="text-xs text-slate-500">
          {t("Accepted goods receipts with no bill (a cancelled bill doesn't count), oldest first. Valued at the purchase order's prices for what was accepted, less goods sent back for a debit note, in the company currency.")}{" "}
          <Link to="/purchaseInvoices" className="font-medium text-cyan-700 hover:underline">
            {t("Purchase Invoices")}
          </Link>
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["grnNumber", "poNumber", "vendorName"]}
          searchPlaceholder={t("Search receipts or vendors")}
          defaultSortKey="daysWaiting"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <InboxArrowDownIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Every goods receipt is billed")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default ReceivedNotBilled;
