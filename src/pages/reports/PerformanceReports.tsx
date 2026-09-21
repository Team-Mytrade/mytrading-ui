import React, { useState, useMemo } from "react";

interface Performance {
  id: number;
  repName: string;
  team: string;
  totalDeals: number;
  closedWon: number;
  closedLost: number;
  revenue: number;
}

const samplePerformance: Performance[] = [
  { id: 1, repName: "John Doe", team: "East", totalDeals: 50, closedWon: 30, closedLost: 15, revenue: 250000 },
  { id: 2, repName: "Jane Smith", team: "West", totalDeals: 40, closedWon: 25, closedLost: 10, revenue: 200000 },
  { id: 3, repName: "Emily Johnson", team: "East", totalDeals: 60, closedWon: 40, closedLost: 15, revenue: 300000 },
  { id: 4, repName: "Michael Brown", team: "North", totalDeals: 30, closedWon: 20, closedLost: 5, revenue: 150000 },
];

const PAGE_SIZE = 5;

type SortField = "repName" | "team" | "totalDeals" | "closedWon" | "closedLost" | "revenue" | "closedWonPercent";
type SortOrder = "asc" | "desc";

const PerformanceReports: React.FC = () => {
  const [performance] = useState(samplePerformance);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("repName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const performanceWithCalc = performance.map(p => ({
    ...p,
    closedWonPercent: p.totalDeals ? (p.closedWon / p.totalDeals) * 100 : 0,
    avgDealSize: p.closedWon ? p.revenue / p.closedWon : 0,
  }));

  const sortedData = useMemo(() => {
    return performanceWithCalc.slice().sort((a, b) => {
      let cmp = 0;
      switch(sortField) {
        case "repName": cmp = a.repName.localeCompare(b.repName); break;
        case "team": cmp = a.team.localeCompare(b.team); break;
        case "totalDeals": cmp = a.totalDeals - b.totalDeals; break;
        case "closedWon": cmp = a.closedWon - b.closedWon; break;
        case "closedLost": cmp = a.closedLost - b.closedLost; break;
        case "revenue": cmp = a.revenue - b.revenue; break;
        case "closedWonPercent": cmp = a.closedWonPercent - b.closedWonPercent; break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [performanceWithCalc, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);
  const pageData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Aggregated summary
  const totalRevenue = performanceWithCalc.reduce((acc, p) => acc + p.revenue, 0);
  const totalDeals = performanceWithCalc.reduce((acc, p) => acc + p.totalDeals, 0);
  const totalClosedWon = performanceWithCalc.reduce((acc, p) => acc + p.closedWon, 0);
  const overallWinPercent = totalDeals ? (totalClosedWon / totalDeals) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Performance Reports</h2>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-4 text-center">
        <div className="bg-green-100 rounded p-4">
          <div className="text-3xl font-bold">{totalRevenue.toLocaleString(undefined, { style: "currency", currency: "USD" })}</div>
          <div>Total Revenue</div>
        </div>
        <div className="bg-blue-100 rounded p-4">
          <div className="text-3xl font-bold">{totalDeals}</div>
          <div>Total Deals</div>
        </div>
        <div className="bg-yellow-100 rounded p-4">
          <div className="text-3xl font-bold">{totalClosedWon}</div>
          <div>Closed Won</div>
        </div>
        <div className="bg-purple-100 rounded p-4">
          <div className="text-3xl font-bold">{overallWinPercent.toFixed(2)}%</div>
          <div>Win Rate</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4 cursor-pointer select-none">
            <tr>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("repName")}>
                Rep Name {sortField === "repName" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("team")}>
                Team {sortField === "team" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-right" onClick={() => handleSort("totalDeals")}>
                Total Deals {sortField === "totalDeals" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-right" onClick={() => handleSort("closedWon")}>
                Closed Won {sortField === "closedWon" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-right" onClick={() => handleSort("closedLost")}>
                Closed Lost {sortField === "closedLost" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-right" onClick={() => handleSort("revenue")}>
                Revenue {sortField === "revenue" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-right" onClick={() => handleSort("closedWonPercent")}>
                Win % {sortField === "closedWonPercent" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-right">Avg Deal Size</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-gray-500">
                  No data found.
                </td>
              </tr>
            ) : (
              pageData.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50 dark:hover:bg-meta-3">
                  <td className="px-4 py-2">{p.repName}</td>
                  <td className="px-4 py-2">{p.team}</td>
                  <td className="px-4 py-2 text-right">{p.totalDeals}</td>
                  <td className="px-4 py-2 text-right">{p.closedWon}</td>
                  <td className="px-4 py-2 text-right">{p.closedLost}</td>
                  <td className="px-4 py-2 text-right">${p.revenue.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{p.closedWonPercent.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right">${p.avgDealSize.toFixed(2)}</td>
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
  );
};

export default PerformanceReports;
