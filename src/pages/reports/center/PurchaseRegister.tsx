import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { INVOICE_API, apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import { ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, SelectField, TotalCard, count, initialPeriod, num, useSyncedParams, useVendorOptions } from "./reportKit";
import { t } from "../../../i18n/i18n";

interface RegisterRow {
  date: string;
  type: "BILL" | "DEBIT_NOTE";
  documentId: number;
  number?: string | null;
  billNumber?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  poNumber?: string | null;
  grnNumber?: string | null;
  currency?: string | null;
  documentTotal?: number | null;
  net: number;
  tax: number;
  total: number;
}

interface Register {
  rows: RegisterRow[];
  totals: { billed: number; debited: number; net: number; tax: number; total: number; bills: number; debitNotes: number; vendors: number };
}

type Row = RegisterRow & { id: string };

const MODULES = ["PURCHASE", "INVOICE"];

/** Every vendor bill and applied debit note in a period (backlog 8.2.1.4): net, tax and total in the company currency. */
const PurchaseRegister: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [report, setReport] = useState<Register | null>(null);
  const [loading, setLoading] = useState(false);
  const vendors = useVendorOptions();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Register>(`${INVOICE_API}/reports/purchases/register`, {
        params: { from: period.from, to: period.to, vendorId: vendorId || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the purchase register"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, vendorId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: `${r.type}-${r.documentId}` })), [report]);
  const totals = report?.totals;
  const typeLabel = (r: RegisterRow) => t(r.type === "DEBIT_NOTE" ? "Debit note" : "Bill");

  const columns: ColumnDef<Row>[] = [
    { key: "date", label: "Date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    {
      key: "number",
      label: "Document",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.number ?? "—"}</span>
          <span className={`block text-xs ${r.type === "DEBIT_NOTE" ? "text-red-600" : "text-slate-500"}`}>
            {typeLabel(r)}
            {r.type === "DEBIT_NOTE" && r.billNumber ? ` · ${r.billNumber}` : ""}
          </span>
        </span>
      ),
    },
    { key: "vendorName", label: "Vendor", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.vendorName ?? "—"}</span> },
    {
      key: "poNumber",
      label: "Order / receipt",
      sortable: true,
      render: (r) => <span className="text-sm text-slate-600">{[r.poNumber, r.grnNumber].filter(Boolean).join(" · ") || "—"}</span>,
    },
    {
      key: "documentTotal",
      label: "Document currency",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (r) => <span className="text-sm text-slate-500">{r.currency ? money(r.documentTotal, r.currency) : "—"}</span>,
    },
    ...(["net", "tax", "total"] as const).map(
      (key): ColumnDef<Row> => ({
        key,
        label: key === "net" ? "Net" : key === "tax" ? "Tax" : "Total",
        sortable: true,
        headerClassName: "text-right",
        className: "text-right",
        sortValueGetter: (r) => num(r[key]),
        render: (r) => <span className={`text-sm ${num(r[key]) < 0 ? "text-red-600" : key === "total" ? "font-semibold text-slate-900" : "text-slate-700"}`}>{money(r[key])}</span>,
      })
    ),
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Date", value: (r) => (r.date ? dateLabel(r.date) : "") },
    { label: "Type", value: (r) => (r.date ? typeLabel(r) : "") },
    { label: "Document", value: (r) => r.number ?? "" },
    { label: "Bill", value: (r) => (r.type === "DEBIT_NOTE" ? r.billNumber ?? "" : "") },
    { label: "Vendor", value: (r) => r.vendorName ?? "" },
    { label: "Purchase order", value: (r) => r.poNumber ?? "" },
    { label: "Goods receipt", value: (r) => r.grnNumber ?? "" },
    { label: "Net", value: (r) => num(r.net), format: "money" },
    { label: "Tax", value: (r) => num(r.tax), format: "money" },
    { label: "Total", value: (r) => num(r.total), format: "money" },
  ];
  const totalsRow = totals
    ? ({ id: "totals", date: "", type: "BILL", documentId: 0, number: t("Total"), net: totals.net, tax: totals.tax, total: totals.total } as Row)
    : undefined;
  const details = vendorId ? [{ label: "Vendor", value: vendors.find((v) => v.value === vendorId)?.label ?? `#${vendorId}` }] : [];

  return (
    <>
      <PageMeta title={t("Purchase Register")} description="Vendor bills and debit notes in a period" />
      <PageBreadcrumb pageTitle="Purchase Register" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Purchase Register", period, columns: exportColumns, rows, totals: totalsRow, details }} />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {vendors.length > 0 && <SelectField label="Vendor" value={vendorId} options={vendors} allLabel="All vendors" onChange={setVendorId} />}
        </FilterBar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Billed" tone="cyan" value={money(totals?.billed)} hint={count(totals?.bills, "bill", "bills")} />
          <TotalCard label="Debit notes" tone="red" value={money(totals?.debited)} hint={count(totals?.debitNotes, "debit note", "debit notes")} />
          <TotalCard label="Net purchases" tone="green" value={money(totals?.net)} hint={count(totals?.vendors, "vendor", "vendors")} />
          <TotalCard label="Total with tax" value={money(totals?.total)} hint={`${t("Tax")} ${money(totals?.tax)}`} />
        </div>

        <p className="text-xs text-slate-500">
          {t("Bills by bill date and debit notes applied to a bill by their date; cancelled and opening bills are left out. Amounts are in the company currency.")}{" "}
          <Link to={`/reports/purchase-analysis?from=${period.from}&to=${period.to}`} className="font-medium text-cyan-700 hover:underline">
            {t("Purchase Analysis")}
          </Link>
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["number", "billNumber", "vendorName", "poNumber", "grnNumber"]}
          searchPlaceholder={t("Search documents or vendors")}
          defaultSortKey="date"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <DocumentMagnifyingGlassIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default PurchaseRegister;
