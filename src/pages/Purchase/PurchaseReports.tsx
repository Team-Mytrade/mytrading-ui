import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import StatsCard from "../../components/common/Statscard";
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

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));

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
    loadReport();
  }, []);

  const vendorRows = useMemo(
    () =>
      Object.entries(report.purchaseByVendor || {}).map(([vendor, total], index) => ({
        id: index + 1,
        vendor,
        total,
      })),
    [report.purchaseByVendor]
  );

  const monthRows = useMemo(
    () =>
      Object.entries(report.monthlyPurchaseTotals || {}).map(([month, total], index) => ({
        id: index + 1,
        month,
        total,
      })),
    [report.monthlyPurchaseTotals]
  );

  const turnaroundRows = useMemo(
    () => (report.turnaroundReport || []).map((row, index) => ({ ...row, id: row.purchaseOrderId || index + 1 })),
    [report.turnaroundReport]
  );

  const vendorTotal = vendorRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const monthlyTotal = monthRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const averageTurnaround =
    turnaroundRows.length > 0
      ? Math.round(turnaroundRows.reduce((sum, row) => sum + Number(row.turnaroundDays || 0), 0) / turnaroundRows.length)
      : 0;

  const valueColumns: ColumnDef<{ id: number; [key: string]: any }>[] = [
    { key: "vendor", label: "Vendor", sortable: true },
    { key: "month", label: "Month", sortable: true },
    {
      key: "total",
      label: "Total",
      sortable: true,
      render: (_row, value) => <span className="font-semibold text-gray-900">{money(Number(value))}</span>,
    },
  ];

  const turnaroundColumns: ColumnDef<TurnaroundRow>[] = [
    { key: "purchaseOrderId", label: "Purchase Order ID", sortable: true },
    { key: "vendor", label: "Vendor", sortable: true },
    { key: "orderDate", label: "Order Date", sortable: true },
    { key: "receivedDate", label: "Received Date", sortable: true },
    { key: "turnaroundDays", label: "Turnaround Days", sortable: true },
  ];

  return (
    <>
      <PageMeta title="Purchase Reports" description="Purchase report data from the Purchase Service reports controller." />
      <PageBreadcrumb pageTitle="Purchase Reports" />

      <div className="w-full px-0 py-6 space-y-6">
        <div className="flex justify-start sm:justify-end lg:-mt-[134px]">
          <button
            type="button"
            onClick={loadReport}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard label="Purchase By Vendor" value={money(vendorTotal)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<TruckIcon className="h-5 w-5" />} />
          <StatsCard label="Monthly Total" value={money(monthlyTotal)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<ChartBarIcon className="h-5 w-5" />} />
          <StatsCard label="Avg Turnaround" value={`${averageTurnaround} days`} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<ClockIcon className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Purchase By Vendor</h2>
            <ReusableTable
              data={vendorRows}
              columns={valueColumns.filter((column) => column.key !== "month")}
              loading={loading}
              searchable
              searchFields={["vendor"]}
              pageSize={5}
              defaultSortKey="vendor"
              rowDetailsTitle="Vendor Purchase"
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Monthly Purchase Totals</h2>
            <ReusableTable
              data={monthRows}
              columns={valueColumns.filter((column) => column.key !== "vendor")}
              loading={loading}
              searchable
              searchFields={["month"]}
              pageSize={5}
              defaultSortKey="month"
              rowDetailsTitle="Monthly Purchase"
            />
          </section>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Turnaround Report</h2>
          <ReusableTable
            data={turnaroundRows}
            columns={turnaroundColumns}
            loading={loading}
            searchable
            searchFields={["vendor", "purchaseOrderId"]}
            pageSize={10}
            defaultSortKey="purchaseOrderId"
            rowDetailsTitle="Turnaround Report"
          />
        </section>
      </div>
    </>
  );
}
