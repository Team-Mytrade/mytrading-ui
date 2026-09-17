import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowPathIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";

type TurnaroundRow = {
  id?: number;
  purchaseOrderId: number;
  vendor: string;
  orderDate: string;
  receivedDate: string;
  turnaroundDays: number;
};

type PurchaseReport = {
  purchaseByVendor?: Record<string, number>;
  monthlyPurchaseTotals?: Record<string, number>;
  turnaroundReport?: TurnaroundRow[];
};

type VendorSpendRow = {
  id: number;
  vendor: string;
  total: number;
};

type MonthlySpendRow = {
  id: number;
  month: string;
  total: number;
  monthRank: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value || 0));

const monthRanks: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function getMonthRank(value: string) {
  const trimmed = String(value || "").trim();
  const normalized = trimmed.toLowerCase();

  if (monthRanks[normalized]) return monthRanks[normalized];

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) return date.getMonth() + 1;

  return Number.MAX_SAFE_INTEGER;
}

function formatDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTooltipValue(value: unknown) {
  return money(Number(value || 0));
}

function turnaroundTone(days: number) {
  if (days <= 3) return "bg-emerald-100 text-emerald-700";
  if (days <= 7) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function PurchaseReports() {
  const [report, setReport] = useState<PurchaseReport>({});
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/v1/api/purchase/reports", {
        skipSessionExpiredHandling: true,
      } as any);
      setReport(res.data || {});
    } catch (error: any) {
      console.error("Failed to load purchase reports", error);
      const status = error?.response?.status;
      const message =
        status === 401 || status === 403
          ? "Purchase reports API is not authorized for this user/session"
          : "Failed to load purchase reports";
      ToasterService.error(message);
      setReport({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  const vendorRows = useMemo<VendorSpendRow[]>(
    () =>
      Object.entries(report.purchaseByVendor || {})
        .map(([vendor, total], index) => ({
          id: index + 1,
          vendor,
          total: Number(total || 0),
        }))
        .sort((a, b) => b.total - a.total),
    [report.purchaseByVendor]
  );

  const monthRows = useMemo<MonthlySpendRow[]>(
    () =>
      Object.entries(report.monthlyPurchaseTotals || {})
        .map(([month, total], index) => ({
          id: index + 1,
          month,
          total: Number(total || 0),
          monthRank: getMonthRank(month),
        }))
        .sort((a, b) => a.monthRank - b.monthRank || b.total - a.total),
    [report.monthlyPurchaseTotals]
  );

  const turnaroundRows = useMemo(
    () =>
      (report.turnaroundReport || []).map((row, index) => ({
        ...row,
        id: row.purchaseOrderId || index + 1,
      })),
    [report.turnaroundReport]
  );

  const totalSpend = vendorRows.reduce((sum, row) => sum + row.total, 0);
  const totalVendors = vendorRows.length;
  const totalMonths = monthRows.length;
  const averageTurnaround =
    turnaroundRows.length > 0
      ? turnaroundRows.reduce((sum, row) => sum + Number(row.turnaroundDays || 0), 0) / turnaroundRows.length
      : 0;

  const bestMonth = [...monthRows].sort((a, b) => b.total - a.total)[0];

  const vendorChartData = vendorRows.slice(0, 6).map((row) => ({
    name: row.vendor,
    total: row.total,
  }));

  const monthChartData = monthRows.map((row) => ({
    name: row.month,
    total: row.total,
  }));

  const vendorTableColumns: ColumnDef<VendorSpendRow>[] = [
    {
      key: "vendor",
      label: "Vendor",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.vendor}</div>
        </div>
      ),
    },
    {
      key: "total",
      label: "Total Spend",
      sortable: true,
      render: (_row, value) => <span className="font-semibold text-slate-900">{money(Number(value || 0))}</span>,
    },
  ];

  const monthTableColumns: ColumnDef<MonthlySpendRow>[] = [
    {
      key: "month",
      label: "Month",
      sortable: true,
      sortValueGetter: (row) => row.monthRank,
      render: (row) => (
        <div>
          <div className="font-semibold uppercase tracking-wide text-slate-900">{row.month}</div>
        </div>
      ),
    },
    {
      key: "total",
      label: "Total Spend",
      sortable: true,
      render: (_row, value) => <span className="font-semibold text-slate-900">{money(Number(value || 0))}</span>,
    },
  ];

  const turnaroundColumns: ColumnDef<TurnaroundRow>[] = [
    {
      key: "purchaseOrderId",
      label: "PO ID",
      sortable: true,
      render: (_row, value) => <span className="font-semibold text-slate-900">#{String(value ?? "--")}</span>,
    },
    { key: "vendor", label: "Vendor", sortable: true },
    {
      key: "orderDate",
      label: "Order Date",
      sortable: true,
      render: (_row, value) => <span>{formatDate(String(value || ""))}</span>,
    },
    {
      key: "receivedDate",
      label: "Received Date",
      sortable: true,
      render: (_row, value) => <span>{formatDate(String(value || ""))}</span>,
    },
    {
      key: "turnaroundDays",
      label: "Turnaround",
      sortable: true,
      render: (_row, value) => {
        const days = Number(value || 0);
        return (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${turnaroundTone(days)}`}>
            {days} day{days === 1 ? "" : "s"}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageMeta title="Purchase Reports" description="Purchase analytics from the purchase reports controller." />
      <PageBreadcrumb pageTitle="Purchase Reports" />

      <div className="space-y-6 px-0 py-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Purchase Reports</h1>
            <p className="mt-1 text-sm text-slate-500">Vendor totals, monthly totals, and turnaround details.</p>
          </div>

          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Spend"
            value={money(totalSpend)}
            icon={<BuildingStorefrontIcon className="h-6 w-6" />}
          />
          <SummaryCard
            title="Best Month"
            value={bestMonth ? bestMonth.month : "--"}
            icon={<CalendarDaysIcon className="h-6 w-6" />}
          />
          <SummaryCard
            title="Avg Turnaround"
            value={`${averageTurnaround ? averageTurnaround.toFixed(1) : "0.0"} days`}
            icon={<ClockIcon className="h-6 w-6" />}
          />
          <SummaryCard
            title="Vendors"
            value={String(totalVendors)}
            icon={<BuildingStorefrontIcon className="h-6 w-6" />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Monthly Purchase Trend">
            {monthChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="purchaseMonthlyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={formatTooltipValue} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#0891b2"
                    strokeWidth={3}
                    fill="url(#purchaseMonthlyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="No monthly purchase totals available" />
            )}
          </ChartCard>

          <ChartCard title="Purchase By Vendor">
            <div className="h-full">
              {vendorChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip formatter={formatTooltipValue} />
                    <Bar dataKey="total" fill="#06b6d4" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No vendor spend data available" />
              )}
            </div>
          </ChartCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Purchase By Vendor</h3>
            <ReusableTable
              data={vendorRows}
              columns={vendorTableColumns}
              loading={loading}
              searchable
              searchFields={["vendor"]}
              pageSize={5}
              defaultSortKey="total"
              defaultSortOrder="desc"
              rowDetailsTitle="Vendor Spend"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Monthly Purchase Totals</h3>
            <ReusableTable
              data={monthRows}
              columns={monthTableColumns}
              loading={loading}
              searchable
              searchFields={["month"]}
              pageSize={5}
              defaultSortKey="month"
              rowDetailsTitle="Monthly Purchase"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Turnaround Report</h3>
            <span className="text-sm text-slate-500">{totalMonths} month{totalMonths === 1 ? "" : "s"} in report</span>
          </div>
          <ReusableTable
            data={turnaroundRows}
            columns={turnaroundColumns}
            loading={loading}
            searchable
            searchFields={["vendor", "purchaseOrderId"]}
            pageSize={8}
            defaultSortKey="turnaroundDays"
            defaultSortOrder="asc"
            rowDetailsTitle="Turnaround Report"
          />
        </section>
      </div>
    </>
  );
}
