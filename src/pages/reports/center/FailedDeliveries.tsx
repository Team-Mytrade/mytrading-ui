import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { money } from "../../Invoice/invoiceShared";
import { formatDateTime } from "../../../company/format";
import { useLanguage } from "../../../i18n/i18n";
import { BarList, ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, TotalCard, initialPeriod, useSyncedParams } from "./reportKit";
import { DeliveryRow, FailedDelivery, ended, tr, useDeliveryReport, vehicleCost } from "./deliveryReports";

type View = "reasons" | "drivers" | "routes" | "customers" | "vehicles";

const VIEWS: { value: View; label: string }[] = [
  { value: "reasons", label: "By reason" },
  { value: "drivers", label: "By driver" },
  { value: "routes", label: "By route" },
  { value: "customers", label: "By customer" },
  { value: "vehicles", label: "By vehicle" },
];

type Row = FailedDelivery & { id: string; redeliveryCost?: number };

const MODULES = ["DELIVERY"];
const own = (label?: string | null) => (label && ["Not recorded", "No route", "No vehicle", "No reason given"].includes(label) ? tr(label) : label ?? "—");

/** Failed deliveries (backlog DEL-4): returned or cancelled on the road, by reason, driver, route, customer and vehicle. */
const FailedDeliveries: React.FC = () => {
  useLanguage();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [view, setView] = useState<View>(() => VIEWS.find((v) => v.value === params.get("view"))?.value ?? "reasons");
  const { report, costs, loading, error } = useDeliveryReport(period);
  useSyncedParams(setParams, { from: period.from, to: period.to, view });

  // A vehicle's cost per delivery in the period: what sending it again costs, roughly
  const perDelivery = useMemo(() => {
    const map: Record<string, number> = {};
    (report?.vehicles ?? []).forEach((v: DeliveryRow) => {
      const cost = vehicleCost(v, costs);
      if (cost != null && ended(v) > 0) map[v.key] = cost / ended(v);
    });
    return map;
  }, [report, costs]);

  const rows: Row[] = useMemo(() => (report?.failed ?? []).map((f) => ({
    ...f, id: String(f.deliveryOrderId), redeliveryCost: f.vehicleId != null ? perDelivery[String(f.vehicleId)] : undefined,
  })), [report, perDelivery]);
  const redeliveryCost = costs === null ? null : rows.reduce((sum, r) => sum + (r.redeliveryCost ?? 0), 0);
  const s = report?.summary;

  const chart = useMemo(() => {
    if (!report) return [];
    if (view === "reasons") {
      return report.reasons.map((r) => ({ key: r.reason, label: own(r.reason), value: r.count, display: `${r.count} (${r.percent}%)` }));
    }
    return report[view].filter((r) => r.failed > 0).sort((a, b) => b.failed - a.failed).slice(0, 10)
      .map((r) => ({ key: r.key, label: own(r.label), value: r.failed, display: `${r.failed} / ${ended(r)} (${r.failedPercent}%)` }));
  }, [report, view]);

  const columns: ColumnDef<Row>[] = [
    { key: "number", label: tr("Delivery order"), sortable: true, render: (r) => <span className="text-sm font-semibold text-slate-900">{r.number}</span> },
    { key: "at", label: tr("Date"), sortable: true, sortValueGetter: (r) => r.at ?? "", render: (r) => <span className="whitespace-nowrap text-sm">{formatDateTime(r.at ?? undefined)}</span> },
    { key: "customerName", label: tr("Customer"), sortable: true, render: (r) => <span className="text-sm">{r.customerName ?? "—"}</span> },
    {
      key: "reason",
      label: tr("Reason"),
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          {own(r.reason)}
          <span className="ms-1 text-xs text-slate-400">({tr(r.status === "RETURNED" ? "Returned" : "Cancelled")})</span>
        </span>
      ),
    },
    { key: "driver", label: tr("Driver"), sortable: true, render: (r) => <span className="text-sm">{own(r.driver)}</span> },
    { key: "vehiclePlate", label: tr("Vehicle"), sortable: true, render: (r) => <span className="text-sm">{r.vehiclePlate ?? "—"}</span> },
    { key: "route", label: tr("Route"), sortable: true, render: (r) => <span className="text-sm">{own(r.route)}</span> },
    {
      key: "redeliveredBy",
      label: tr("Sent again on"),
      sortable: true,
      render: (r) => <span className={`text-sm ${r.redeliveredBy ? "text-green-700" : "text-amber-700"}`}>{r.redeliveredBy ?? tr("Not yet")}</span>,
    },
    ...(costs !== null
      ? ([{ key: "redeliveryCost", label: tr("Re-delivery cost (estimate)"), sortable: true, headerClassName: "text-right", className: "text-right",
          render: (r: Row) => <span className="text-sm">{r.redeliveryCost == null ? "—" : money(r.redeliveryCost)}</span> }] as ColumnDef<Row>[])
      : []),
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: tr("Delivery order"), value: (r) => r.number },
    { label: tr("Date"), value: (r) => formatDateTime(r.at ?? undefined) },
    { label: tr("Customer"), value: (r) => r.customerName ?? "" },
    { label: tr("Reason"), value: (r) => own(r.reason) },
    { label: tr("Status"), value: (r) => tr(r.status === "RETURNED" ? "Returned" : "Cancelled") },
    { label: tr("Driver"), value: (r) => own(r.driver) },
    { label: tr("Vehicle"), value: (r) => r.vehiclePlate ?? "" },
    { label: tr("Route"), value: (r) => own(r.route) },
    { label: tr("Sent again on"), value: (r) => r.redeliveredBy ?? tr("Not yet") },
    ...(costs !== null ? ([{ label: tr("Re-delivery cost (estimate)"), value: (r: Row) => r.redeliveryCost ?? "", format: "money" }] as ReportColumn<Row>[]) : []),
  ];

  return (
    <>
      <PageMeta title={tr("Failed Deliveries")} description="Returned and failed deliveries by reason" />
      <PageBreadcrumb pageTitle={tr("Failed Deliveries")} />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0}
            report={{ title: tr("Failed Deliveries"), period, columns: exportColumns, rows }} />}
        >
          <PeriodPicker value={period} onChange={setPeriod} />
        </FilterBar>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label={tr("Failed")} tone="red" value={String(s?.failed ?? 0)} hint={tr("Returned, or cancelled on the road")} />
          <TotalCard label={tr("Failed %")} value={`${s?.failedPercent ?? 0}%`} hint={s ? `${s.failed} / ${ended(s)}` : undefined} />
          <TotalCard label={tr("Sent again")} tone="green" value={String(s?.redelivered ?? 0)} hint={s ? `${tr("Not yet")}: ${s.failed - s.redelivered}` : undefined} />
          <TotalCard label={tr("Re-delivery cost (estimate)")} tone="cyan" value={redeliveryCost == null ? "—" : money(redeliveryCost)}
            hint={redeliveryCost == null ? tr("Costs need the Finance view right; trips and deliveries still show.") : tr("Failed deliveries × the vehicle's cost per delivery")} />
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {VIEWS.map((v) => (
            <button key={v.value} type="button" role="tab" aria-selected={v.value === view} onClick={() => setView(v.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${v.value === view ? "bg-cyan-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {tr(v.label)}
            </button>
          ))}
        </div>

        <BarList title={view === "reasons" ? tr("Top reasons") : tr(VIEWS.find((v) => v.value === view)?.label ?? "")} rows={chart}
          empty={loading ? tr("Loading…") : tr("Nothing in this period")} />

        <p className="text-xs text-slate-500">
          {tr("A delivery counts in the period its last status changed in. Failed: returned, or cancelled on the road with a reason. Sent again: a later delivery order for the same sales order.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          defaultSortKey="at"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ExclamationTriangleIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{tr("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default FailedDeliveries;
