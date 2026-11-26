import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TruckIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { money } from "../../Invoice/invoiceShared";
import { useLanguage } from "../../../i18n/i18n";
import { BarList, ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, TotalCard, initialPeriod, num, useSyncedParams } from "./reportKit";
import { DeliveryRow, ended, tr, useDeliveryReport, vehicleCost } from "./deliveryReports";

type GroupBy = "vehicles" | "drivers" | "routes" | "customers";

const GROUPS: { value: GroupBy; label: string; column: string }[] = [
  { value: "vehicles", label: "By vehicle", column: "Vehicle" },
  { value: "drivers", label: "By driver", column: "Driver" },
  { value: "routes", label: "By route", column: "Route" },
  { value: "customers", label: "By customer", column: "Customer" },
];

type Row = DeliveryRow & { id: string; cost?: number; perDelivery?: number; perKm?: number };

const MODULES = ["DELIVERY"];
// The service's own labels for "none" are translated; plates, names and routes are not
const own = (label: string) => (["Not recorded", "No route", "No vehicle"].includes(label) ? tr(label) : label);
const km = (value: number) => `${num(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${tr("km")}`;

/** Delivery cost (backlog DEL-4): trips, km and deliveries per vehicle, driver, route or customer, and each vehicle's cost. */
const DeliveryCost: React.FC = () => {
  useLanguage();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => GROUPS.find((g) => g.value === params.get("groupBy"))?.value ?? "vehicles");
  const { report, costs, loading, error } = useDeliveryReport(period);
  useSyncedParams(setParams, { from: period.from, to: period.to, groupBy });

  const group = GROUPS.find((g) => g.value === groupBy) ?? GROUPS[0];
  const withCost = groupBy === "vehicles" && costs !== null;
  const rows: Row[] = useMemo(() => (report?.[groupBy] ?? []).map((r) => {
    const cost = groupBy === "vehicles" ? vehicleCost(r, costs) : undefined;
    const deliveries = ended(r);
    return { ...r, id: r.key, cost, perDelivery: cost != null && deliveries > 0 ? cost / deliveries : undefined,
      perKm: cost != null && r.distanceKm > 0 ? cost / r.distanceKm : undefined };
  }), [report, groupBy, costs]);

  const fleetCost = useMemo(() => (report && costs ? report.vehicles.reduce((sum, v) => sum + (vehicleCost(v, costs) ?? 0), 0) : null), [report, costs]);
  const allDeliveries = report ? ended(report.summary) : 0;
  const s = report?.summary;

  const columns: ColumnDef<Row>[] = [
    {
      key: "label",
      label: tr(group.column),
      sortable: true,
      sortValueGetter: (r) => own(r.label),
      render: (r) => <span className="text-sm font-semibold text-slate-900">{own(r.label)}</span>,
    },
    { key: "trips", label: tr("Trips"), sortable: true, headerClassName: "text-right", className: "text-right", render: (r) => <span className="text-sm">{r.trips}</span> },
    { key: "distanceKm", label: tr("Distance"), sortable: true, headerClassName: "text-right", className: "text-right", render: (r) => <span className="text-sm">{km(r.distanceKm)}</span> },
    { key: "delivered", label: tr("Delivered"), sortable: true, headerClassName: "text-right", className: "text-right", render: (r) => <span className="text-sm">{r.delivered}</span> },
    { key: "partial", label: tr("Partly"), sortable: true, headerClassName: "text-right", className: "text-right", render: (r) => <span className="text-sm">{r.partial}</span> },
    {
      key: "failed",
      label: tr("Failed"),
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (r) => <span className={`text-sm ${r.failed ? "font-semibold text-red-600" : ""}`}>{r.failed}{r.failed ? ` (${r.failedPercent}%)` : ""}</span>,
    },
    ...(withCost
      ? ([
          { key: "cost", label: tr("Cost"), sortable: true, headerClassName: "text-right", className: "text-right", sortValueGetter: (r) => num(r.cost),
            render: (r) => <span className="text-sm font-semibold">{r.costCentreId == null ? <span className="font-normal text-slate-400">{tr("No cost centre")}</span> : money(r.cost)}</span> },
          { key: "perDelivery", label: tr("Cost / delivery"), sortable: true, headerClassName: "text-right", className: "text-right", sortValueGetter: (r) => num(r.perDelivery),
            render: (r) => <span className="text-sm">{r.perDelivery == null ? "—" : money(r.perDelivery)}</span> },
          { key: "perKm", label: tr("Cost / km"), sortable: true, headerClassName: "text-right", className: "text-right", sortValueGetter: (r) => num(r.perKm),
            render: (r) => <span className="text-sm">{r.perKm == null ? "—" : money(r.perKm)}</span> },
        ] as ColumnDef<Row>[])
      : []),
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: tr(group.column), value: (r) => own(r.label) },
    { label: tr("Trips"), value: (r) => r.trips, format: "number" },
    { label: tr("Km"), value: (r) => num(r.distanceKm), format: "number" },
    { label: tr("Delivered"), value: (r) => r.delivered, format: "number" },
    { label: tr("Partly"), value: (r) => r.partial, format: "number" },
    { label: tr("Failed"), value: (r) => r.failed, format: "number" },
    { label: tr("Failed %"), value: (r) => num(r.failedPercent), format: "percent" },
    ...(withCost
      ? ([
          { label: tr("Cost"), value: (r) => (r.cost == null ? "" : num(r.cost)), format: "money" },
          { label: tr("Cost / delivery"), value: (r) => (r.perDelivery == null ? "" : num(r.perDelivery)), format: "money" },
          { label: tr("Cost / km"), value: (r) => (r.perKm == null ? "" : num(r.perKm)), format: "money" },
        ] as ReportColumn<Row>[])
      : []),
  ];
  const totalsRow: Row | undefined = s
    ? { id: "totals", key: "totals", label: tr("Total"), trips: s.trips, distanceKm: s.distanceKm, delivered: s.delivered, partial: s.partial,
        failed: s.failed, failedPercent: s.failedPercent, cost: groupBy === "vehicles" && fleetCost != null ? fleetCost : undefined,
        perDelivery: groupBy === "vehicles" && fleetCost != null && allDeliveries > 0 ? fleetCost / allDeliveries : undefined,
        perKm: groupBy === "vehicles" && fleetCost != null && s.distanceKm > 0 ? fleetCost / s.distanceKm : undefined }
    : undefined;

  const chart = useMemo(() => (withCost
    ? rows.filter((r) => r.perDelivery != null).map((r) => ({ key: r.key, label: own(r.label), value: num(r.perDelivery), display: money(r.perDelivery) }))
    : rows.slice(0, 10).map((r) => ({ key: r.key, label: own(r.label), value: ended(r), display: String(ended(r)) }))), [rows, withCost]);

  return (
    <>
      <PageMeta title={tr("Delivery Cost")} description="Trips, deliveries and cost per vehicle" />
      <PageBreadcrumb pageTitle={tr("Delivery Cost")} />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0}
            report={{ title: tr("Delivery Cost"), period, columns: exportColumns, rows, totals: totalsRow, details: [{ label: tr("Status"), value: tr(group.label) }] }} />}
        >
          <PeriodPicker value={period} onChange={setPeriod} />
        </FilterBar>

        <div className="flex flex-wrap gap-2" role="tablist">
          {GROUPS.map((g) => (
            <button key={g.value} type="button" role="tab" aria-selected={g.value === groupBy} onClick={() => setGroupBy(g.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${g.value === groupBy ? "bg-cyan-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {tr(g.label)}
            </button>
          ))}
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {report && costs === null && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{tr("Costs need the Finance view right; trips and deliveries still show.")}</p>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label={tr("Trips")} tone="cyan" value={String(s?.trips ?? 0)} hint={s ? km(s.distanceKm) : undefined} />
          <TotalCard label={tr("Deliveries")} tone="green" value={String((s?.delivered ?? 0) + (s?.partial ?? 0))}
            hint={s ? `${tr("With proof of delivery")}: ${s.withProof}` : tr("Delivered or part delivered")} />
          <TotalCard label={tr("Failed")} tone="red" value={String(s?.failed ?? 0)} hint={s ? `${s.failedPercent}%` : undefined} />
          <TotalCard label={tr("Fleet cost")} value={fleetCost == null ? "—" : money(fleetCost)}
            hint={fleetCost != null && allDeliveries > 0 ? `${tr("Cost per delivery")}: ${money(fleetCost / allDeliveries)}` : tr("Expenses on the vehicles' cost centres")} />
        </div>

        <BarList title={withCost ? tr("Cost per delivery by vehicle") : tr("Deliveries")} rows={chart} empty={loading ? tr("Loading…") : tr("Nothing in this period")} />

        <p className="text-xs text-slate-500">
          {tr("Set each vehicle's cost centre (Vehicles page) and charge its fuel, repairs and driver costs to it; the cost here is what that cost centre's expense accounts took in the period.")}{" "}
          {tr("A delivery counts in the period its last status changed in. Failed: returned, or cancelled on the road with a reason. Sent again: a later delivery order for the same sales order.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          defaultSortKey="trips"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <TruckIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{tr("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default DeliveryCost;
