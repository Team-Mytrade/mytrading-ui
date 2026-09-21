import React, { useState, useMemo } from "react";

interface Sale {
  id: number;
  customer: string;
  date: string; // ISO string
  amount: number;
  status: "Pending" | "Closed Won" | "Closed Lost" | "In Progress";
}

const sampleSales: Sale[] = [
  { id: 1, customer: "Acme Corp", date: "2025-07-01", amount: 10000, status: "Closed Won" },
  { id: 2, customer: "Beta Ltd", date: "2025-07-05", amount: 7000, status: "Closed Lost" },
  { id: 3, customer: "Gamma Inc", date: "2025-07-10", amount: 15000, status: "Closed Won" },
  { id: 4, customer: "Delta LLC", date: "2025-07-15", amount: 5000, status: "Pending" },
  // add more sample sales...
];

const PAGE_SIZE = 5;

type SortField = "customer" | "date" | "amount" | "status";
type SortOrder = "asc" | "desc";

const SalesReports: React.FC = () => {
  const [sales] = useState(sampleSales);
  const [filterStatus, setFilterStatus] = useState<"All" | Sale["status"]>("All");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filtering
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const statusMatch = filterStatus === "All" || sale.status === filterStatus;
      const saleDate = new Date(sale.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : null;
      const end = endDate ? new Date(endDate).getTime() : null;
      const dateMatch = (!start || saleDate >= start) && (!end || saleDate <= end);
      return statusMatch && dateMatch;
    });
  }, [sales, filterStatus, startDate, endDate]);

  // Sorting
  const sortedSales = useMemo(() => {
    return filteredSales.slice().sort((a, b) => {
      let cmp = 0;
      if (sortField === "customer") {
        cmp = a.customer.localeCompare(b.customer);
      } else if (sortField === "date") {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === "amount") {
        cmp = a.amount - b.amount;
      } else if (sortField === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filteredSales, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedSales.length / PAGE_SIZE);
  const pageSales = sortedSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary stats
  const totalSalesAmount = filteredSales.reduce((acc, s) => acc + s.amount, 0);
  const totalDeals = filteredSales.length;
  const averageDealSize = totalDeals ? totalSalesAmount / totalDeals : 0;

  // Sort toggling
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Sales Reports</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <select
          className="input input-bordered"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Closed Won">Closed Won</option>
          <option value="Closed Lost">Closed Lost</option>
          <option value="In Progress">In Progress</option>
        </select>

        <input
          type="date"
          className="input input-bordered"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          placeholder="Start Date"
        />
        <input
          type="date"
          className="input input-bordered"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          placeholder="End Date"
        />
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-4 text-center">
        <div className="bg-green-100 rounded p-4">
          <div className="text-3xl font-bold">${totalSalesAmount.toLocaleString()}</div>
          <div>Total Sales Amount</div>
        </div>
        <div className="bg-blue-100 rounded p-4">
          <div className="text-3xl font-bold">{totalDeals}</div>
          <div>Total Deals</div>
        </div>
        <div className="bg-yellow-100 rounded p-4">
          <div className="text-3xl font-bold">${averageDealSize.toFixed(2)}</div>
          <div>Average Deal Size</div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4 cursor-pointer select-none">
            <tr>
              <th
                className="px-4 py-2 text-left"
                onClick={() => handleSort("customer")}
              >
                Customer {sortField === "customer" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                className="px-4 py-2 text-left"
                onClick={() => handleSort("date")}
              >
                Date {sortField === "date" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                className="px-4 py-2 text-left"
                onClick={() => handleSort("amount")}
              >
                Amount {sortField === "amount" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                className="px-4 py-2 text-left"
                onClick={() => handleSort("status")}
              >
                Status {sortField === "status" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageSales.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">
                  No sales found.
                </td>
              </tr>
            ) : (
              pageSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-meta-3"
                >
                  <td className="px-4 py-2">{sale.customer}</td>
                  <td className="px-4 py-2">{sale.date}</td>
                  <td className="px-4 py-2">${sale.amount.toLocaleString()}</td>
                  <td className="px-4 py-2">{sale.status}</td>
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn btn-sm"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="btn btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesReports;
