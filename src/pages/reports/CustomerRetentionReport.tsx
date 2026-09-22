import React, { useState, useMemo } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ReportSummaryGrid from "../../components/common/ReportSummaryGrid";
import ReportDataTable from "../../components/common/ReportDataTable";

interface Customer {
  id: number;
  name: string;
  lastPurchaseDate: string; // ISO string
  firstPurchaseDate: string; // ISO string
  totalOrders: number;
  retained: boolean; // Whether customer is retained (e.g., purchased again in last period)
}

const sampleCustomers: Customer[] = [
  { id: 1, name: "Alice", firstPurchaseDate: "2022-01-15", lastPurchaseDate: "2025-07-01", totalOrders: 12, retained: true },
  { id: 2, name: "Bob", firstPurchaseDate: "2023-03-20", lastPurchaseDate: "2023-09-10", totalOrders: 3, retained: false },
  { id: 3, name: "Charlie", firstPurchaseDate: "2021-06-30", lastPurchaseDate: "2025-06-25", totalOrders: 9, retained: true },
  { id: 4, name: "Diana", firstPurchaseDate: "2024-01-05", lastPurchaseDate: "2024-02-15", totalOrders: 1, retained: false },
  // more...
];

const PAGE_SIZE = 5;

const CustomerRetentionReport: React.FC = () => {
  const [customers] = useState(sampleCustomers);
  const [page, setPage] = useState(1);

  // Calculate retention rate (percentage of retained customers)
  const retainedCount = customers.filter(c => c.retained).length;
  const retentionRate = customers.length ? (retainedCount / customers.length) * 100 : 0;

  const totalPages = Math.ceil(customers.length / PAGE_SIZE);
  const pageData = useMemo(() => {
    return customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [customers, page]);

  return (
    <>
    <PageBreadcrumb pageTitle="Customer Retention Report" />
    <div className="reports-legacy max-w-7xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Customer Retention Report</h2>

      {/* Summary */}
      <ReportSummaryGrid items={[
        { label: "Total Customers", value: customers.length, tone: "blue" },
        { label: "Retention Rate", value: `${retentionRate.toFixed(2)}%`, tone: "green" },
      ]} />

      {/* Customer Table */}
      <ReportDataTable data={customers} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Customer Name</th>
              <th className="px-4 py-2 text-center">First Purchase</th>
              <th className="px-4 py-2 text-center">Last Purchase</th>
              <th className="px-4 py-2 text-center">Total Orders</th>
              <th className="px-4 py-2 text-center">Retained</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">
                  No customers found.
                </td>
              </tr>
            ) : (
              pageData.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50 dark:hover:bg-meta-3">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-center">{new Date(c.firstPurchaseDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-center">{new Date(c.lastPurchaseDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-center">{c.totalOrders}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${c.retained ? "text-green-600" : "text-red-600"}`}>
                    {c.retained ? "Yes" : "No"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="btn btn-sm"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="btn btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default CustomerRetentionReport;
