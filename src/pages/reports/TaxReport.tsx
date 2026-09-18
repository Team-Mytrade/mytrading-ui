import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";

interface TaxReportData {
  totalTaxableAmount?: number;
  totalTaxAmount?: number;
  totalInvoiceAmount?: number;
  taxCollectedByMonth?: Record<string, number>;
}

interface Row {
  id: string;
  month: string;
  amount: number;
}

const API_BASE = "/v1/api/invoice/reports/tax";
const PAGE_SIZE = 10;

const TaxReport: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [report, setReport] = useState<TaxReportData>({});
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
        setReport(res.data as TaxReportData);
      } else {
        setReport({});
      }
    } catch (err) {
      console.error("Error fetching tax report", err);
      ToasterService.error("Failed to load tax report");
      setReport({});
    } finally {
      setIsLoading(false);
    }
  };

  const reportRows: Row[] = useMemo(
    () =>
      Object.entries(report.taxCollectedByMonth || {}).map(([month, amount]) => ({
        id: month,
        month,
        amount,
      })),
    [report.taxCollectedByMonth]
  );

  const filteredRows = useMemo(() => {
    return reportRows.filter((row) => {
      const term = search.toLowerCase();
      const matchesSearch = (row.month || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "CURRENT_YEAR") {
        matchesFilter = true;
      }

      return matchesSearch && matchesFilter;
    });
  }, [reportRows, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalTaxableAmount: Number(report.totalTaxableAmount || 0),
      totalTaxAmount: Number(report.totalTaxAmount || 0),
      totalInvoiceAmount: Number(report.totalInvoiceAmount || 0),
    }),
    [report]
  );

  const tableColumns: ColumnDef<Row>[] = [
    {
      key: "month",
      label: "Month",
      sortable: true,
      headerClassName: "w-[50%] text-left",
      className: "w-[50%]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {row.month || "Unknown"}
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Tax Collected",
      sortable: true,
      headerClassName: "w-[50%] text-right",
      className: "w-[50%] text-right",
      sortValueGetter: (row) => Number(row.amount || 0),
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/40">
          <CreditCardIcon className="h-3.5 w-3.5 text-emerald-600 opacity-80" />
          {Number(row.amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Tax Report" description="Tax collected report" />
      <PageBreadcrumb pageTitle="Tax Report" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={() => ToasterService.info("Tax report is read-only")} label="Add Report" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Taxable Amount"
            value={stats.totalTaxableAmount}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Total Tax Amount"
            value={stats.totalTaxAmount}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Total Invoice Amount"
            value={stats.totalInvoiceAmount}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredRows.length}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search months..."
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
                { label: "Current Year", value: "CURRENT_YEAR" },
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
          defaultSortKey="month"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No tax collected data found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <p className="text-gray-400 text-xs">No monthly tax records available</p>
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

export default TaxReport;
