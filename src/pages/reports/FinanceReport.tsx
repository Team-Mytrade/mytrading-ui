import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ClockIcon,
  CreditCardIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";

interface FinanceReportData {
  totalInvoiced?: number;
  totalPaid?: number;
  outstandingAmount?: number;
  invoiceStatusSummary?: Record<string, number>;
  monthlyTotals?: Record<string, number>;
  overdueInvoices?: Array<{
    customerName?: string;
    dueDate?: string;
    totalAmount?: number;
    paidAmount?: number;
  }>;
}

interface OverdueRow {
  id: string;
  customerName?: string;
  dueDate?: string;
  totalAmount?: number;
  paidAmount?: number;
}

const API_BASE = "/v1/api/invoice/reports/finance";
const PAGE_SIZE = 10;

const FinanceReport: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [report, setReport] = useState<FinanceReportData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_BASE, { headers });
      if (res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
        setReport(res.data as FinanceReportData);
      } else {
        setReport({});
      }
    } catch (err) {
      console.error("Error fetching finance report", err);
      ToasterService.error("Failed to load finance report");
      setReport({});
    } finally {
      setIsLoading(false);
    }
  };

  const reportRows: OverdueRow[] = useMemo(
    () =>
      (report.overdueInvoices || []).map((invoice, index) => ({
        id: `${invoice.customerName || "customer"}-${index}`,
        customerName: invoice.customerName,
        dueDate: invoice.dueDate,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
      })),
    [report.overdueInvoices]
  );

  const filteredRows = useMemo(() => {
    return reportRows.filter((row) => {
      const term = search.toLowerCase();
      const matchesSearch = (row.customerName || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "OVERDUE") {
        matchesFilter = true;
      }

      return matchesSearch && matchesFilter;
    });
  }, [reportRows, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalInvoiced: Number(report.totalInvoiced || 0),
      totalPaid: Number(report.totalPaid || 0),
      outstandingAmount: Number(report.outstandingAmount || 0),
      overdueCount: (report.overdueInvoices || []).length,
    }),
    [report]
  );

  const tableColumns: ColumnDef<OverdueRow>[] = [
    {
      key: "customerName",
      label: "Customer Name",
      sortable: true,
      headerClassName: "w-[30%] text-left",
      className: "w-[30%]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {row.customerName || "Unnamed Customer"}
          </span>
        </div>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (row) => (
        <span className="text-sm text-slate-600 truncate">{row.dueDate || "N/A"}</span>
      ),
    },
    {
      key: "totalAmount",
      label: "Total Amount",
      sortable: true,
      headerClassName: "w-[25%] text-right",
      className: "w-[25%] text-right",
      sortValueGetter: (row) => Number(row.totalAmount || 0),
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200/40">
          <CreditCardIcon className="h-3.5 w-3.5 text-red-600 opacity-80" />
          {Number(row.totalAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "paidAmount",
      label: "Paid Amount",
      sortable: true,
      headerClassName: "w-[25%] text-right",
      className: "w-[25%] text-right",
      sortValueGetter: (row) => Number(row.paidAmount || 0),
      render: (row) => (
        <span className="text-sm text-slate-600">{Number(row.paidAmount || 0).toLocaleString()}</span>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Finance Report" description="Finance overview report" />
      <PageBreadcrumb pageTitle="Finance Report" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={() => ToasterService.info("Finance report is read-only")} label="Add Report" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Invoiced"
            value={stats.totalInvoiced}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Total Paid"
            value={stats.totalPaid}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Outstanding Amount"
            value={stats.outstandingAmount}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="Overdue Invoices"
            value={stats.overdueCount}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            <FilterPopover
              title="Filter Report"
              buttonLabel="Filters"
              label="Report"
              value={activeFilter}
              options={[
                { label: "All Report", value: "ALL" },
                { label: "Overdue Only", value: "OVERDUE" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredRows}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="customerName"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No overdue invoices found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <p className="text-gray-400 text-xs">No overdue invoice records available</p>
              )}
            </div>
          }
        />

        <style>{`
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.25s ease-out;
          }
        `}</style>
      </div>
    </>
  );
};

export default FinanceReport;
