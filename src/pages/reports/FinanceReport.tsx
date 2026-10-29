import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ClockIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, INVOICE_STATUS_TONES, apiError, dateLabel, daysOverdue, money, monthLabel } from "../Invoice/invoiceShared";
import { StatusBadge } from "../Invoice/invoiceUi";

import { t } from "../../i18n/i18n";
interface OverdueInvoice {
  invoiceNumber?: string;
  customerName?: string;
  dueDate?: string;
  totalAmount?: number;
  paidAmount?: number;
  balanceAmount?: number;
}

interface FinanceReportData {
  totalInvoiced?: number;
  totalPaid?: number;
  outstandingAmount?: number;
  invoiceStatusSummary?: Record<string, number>;
  monthlyTotals?: Record<string, number>;
  overdueInvoices?: OverdueInvoice[];
}

type OverdueRow = OverdueInvoice & { id: string };

/** Totals for issued sales invoices: what was billed, collected and is still due. */
const FinanceReport: React.FC = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState<FinanceReportData>({});
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      // A 403 here is a missing report permission, not an expired login
      const res = await axios.get<FinanceReportData>(`${INVOICE_API}/reports/finance`, { skipSessionExpiredHandling: true } as object);
      setReport(res.data && typeof res.data === "object" ? res.data : {});
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load the finance report"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const months = useMemo(() => Object.entries(report.monthlyTotals ?? {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12), [report.monthlyTotals]);
  const maxMonth = Math.max(1, ...months.map(([, value]) => Number(value || 0)));
  const statuses = useMemo(() => Object.entries(report.invoiceStatusSummary ?? {}).filter(([, count]) => Number(count) > 0), [report.invoiceStatusSummary]);

  const overdue: OverdueRow[] = useMemo(
    () => (report.overdueInvoices ?? []).map((row, index) => ({ ...row, id: `${row.invoiceNumber ?? "invoice"}-${index}` })),
    [report.overdueInvoices]
  );
  const overdueTotal = overdue.reduce((sum, row) => sum + Number(row.balanceAmount ?? Number(row.totalAmount || 0) - Number(row.paidAmount || 0)), 0);

  const columns: ColumnDef<OverdueRow>[] = [
    { key: "invoiceNumber", label: "Invoice", sortable: true, render: (row) => <span className="text-sm font-semibold text-slate-900">{row.invoiceNumber ?? "—"}</span> },
    { key: "customerName", label: "Customer", sortable: true, render: (row) => <span className="text-sm text-slate-700">{row.customerName ?? "—"}</span> },
    {
      key: "dueDate",
      label: "Due",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-600">
          {dateLabel(row.dueDate)}
          <span className="block text-xs font-semibold text-red-600">{daysOverdue(row.dueDate)} days late</span>
        </span>
      ),
    },
    { key: "totalAmount", label: "Amount", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm">{money(row.totalAmount)}</span> },
    { key: "paidAmount", label: "Paid", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm text-slate-600">{money(row.paidAmount)}</span> },
    {
      key: "balanceAmount",
      label: "Balance",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (row) => Number(row.balanceAmount || 0),
      render: (row) => <span className="text-sm font-semibold text-red-700">{money(row.balanceAmount ?? Number(row.totalAmount || 0) - Number(row.paidAmount || 0))}</span>,
    },
  ];

  return (
    <>
      <PageMeta title={t("Finance Report")} description="Invoiced, collected and outstanding" />
      <PageBreadcrumb pageTitle="Finance Report" />

      <div className="w-full max-w-none space-y-4 py-4">
        <p className="text-xs text-slate-500">{t("Issued sales invoices only; drafts and cancelled invoices are left out.")}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Invoiced")} value={money(report.totalInvoiced)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Collected")} value={money(report.totalPaid)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Outstanding")} value={money(report.outstandingAmount)} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label={`${t("Overdue")} (${overdue.length})`} value={money(overdueTotal)} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{t("Invoiced by month")}</h2>
            {months.length === 0 ? (
              <p className="text-sm text-slate-400">{t(loading ? "Loading…" : "No issued invoices yet")}</p>
            ) : (
              <ul className="space-y-2">
                {months.map(([key, value]) => (
                  <li key={key} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-sm">
                    <span className="text-slate-600">{monthLabel(key)}</span>
                    <span className="h-2 rounded-full bg-slate-100">
                      <span className="block h-2 rounded-full bg-cyan-500" style={{ width: `${(Number(value || 0) / maxMonth) * 100}%` }} />
                    </span>
                    <span className="font-medium text-slate-800">{money(value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{t("Invoices by status")}</h2>
            {statuses.length === 0 ? (
              <p className="text-sm text-slate-400">{t(loading ? "Loading…" : "No invoices yet")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {statuses.map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between py-2 text-sm">
                    <StatusBadge status={status} tones={INVOICE_STATUS_TONES} />
                    <button type="button" className="font-medium text-cyan-700 hover:underline" onClick={() => navigate("/invoices")}>
                      {count}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <h2 className="pt-2 text-sm font-semibold text-slate-800">{t("Overdue invoices")}</h2>
        <ReusableTable
          data={overdue}
          columns={columns}
          pageSize={10}
          loading={loading}
          defaultSortKey="dueDate"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ClockIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing overdue")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default FinanceReport;
