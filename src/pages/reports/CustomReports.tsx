import React, { useState, useEffect } from "react";

type ReportType = "leads" | "sales" | "customers";

interface ReportFilter {
  startDate: string;
  endDate: string;
  keyword: string;
}

interface ReportData {
  id: number;
  [key: string]: any;
}

const mockData: Record<ReportType, ReportData[]> = {
  leads: [
    { id: 1, name: "Lead One", status: "New", createdAt: "2025-07-01" },
    { id: 2, name: "Lead Two", status: "Contacted", createdAt: "2025-07-05" },
  ],
  sales: [
    { id: 1, customer: "Customer A", amount: 5000, date: "2025-06-30" },
    { id: 2, customer: "Customer B", amount: 3000, date: "2025-07-02" },
  ],
  customers: [
    { id: 1, name: "Alice", lastPurchase: "2025-06-25", totalOrders: 12 },
    { id: 2, name: "Bob", lastPurchase: "2025-07-01", totalOrders: 5 },
  ],
};

const CustomReports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>("leads");
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: "",
    endDate: "",
    keyword: "",
  });
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);

  useEffect(() => {
    let data = mockData[reportType];

    // Filter by date if dates provided
    if (filters.startDate) {
      data = data.filter((d) => {
        const dateField = reportType === "leads" ? d.createdAt : reportType === "sales" ? d.date : d.lastPurchase;
        return new Date(dateField) >= new Date(filters.startDate);
      });
    }
    if (filters.endDate) {
      data = data.filter((d) => {
        const dateField = reportType === "leads" ? d.createdAt : reportType === "sales" ? d.date : d.lastPurchase;
        return new Date(dateField) <= new Date(filters.endDate);
      });
    }

    // Filter by keyword (search in name/customer)
    if (filters.keyword.trim() !== "") {
      const keywordLower = filters.keyword.toLowerCase();
      data = data.filter((d) => {
        if (reportType === "leads") return d.name.toLowerCase().includes(keywordLower) || d.status.toLowerCase().includes(keywordLower);
        if (reportType === "sales") return d.customer.toLowerCase().includes(keywordLower);
        if (reportType === "customers") return d.name.toLowerCase().includes(keywordLower);
        return false;
      });
    }

    setFilteredData(data);
  }, [reportType, filters]);

  const renderTableHeaders = () => {
    switch (reportType) {
      case "leads":
        return (
          <tr>
            <th className="px-4 py-2 text-left">Lead Name</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Created At</th>
          </tr>
        );
      case "sales":
        return (
          <tr>
            <th className="px-4 py-2 text-left">Customer</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2 text-left">Date</th>
          </tr>
        );
      case "customers":
        return (
          <tr>
            <th className="px-4 py-2 text-left">Customer Name</th>
            <th className="px-4 py-2 text-left">Last Purchase</th>
            <th className="px-4 py-2 text-right">Total Orders</th>
          </tr>
        );
    }
  };

  const renderTableRows = () => {
    if (filteredData.length === 0) {
      return (
        <tr>
          <td colSpan={3} className="text-center py-4 text-gray-500">
            No records found.
          </td>
        </tr>
      );
    }

    return filteredData.map((row) => {
      switch (reportType) {
        case "leads":
          return (
            <tr key={row.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2">{row.status}</td>
              <td className="px-4 py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
            </tr>
          );
        case "sales":
          return (
            <tr key={row.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">{row.customer}</td>
              <td className="px-4 py-2 text-right">${row.amount.toLocaleString()}</td>
              <td className="px-4 py-2">{new Date(row.date).toLocaleDateString()}</td>
            </tr>
          );
        case "customers":
          return (
            <tr key={row.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2">{new Date(row.lastPurchase).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-right">{row.totalOrders}</td>
            </tr>
          );
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Custom Reports</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <select
          className="form-select"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
        >
          <option value="leads">Leads</option>
          <option value="sales">Sales</option>
          <option value="customers">Customers</option>
        </select>

        <input
          type="date"
          className="form-input"
          value={filters.startDate}
          onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
          placeholder="Start Date"
        />

        <input
          type="date"
          className="form-input"
          value={filters.endDate}
          onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
          placeholder="End Date"
        />

        <input
          type="text"
          className="form-input flex-grow"
          value={filters.keyword}
          onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
          placeholder="Search keyword"
        />
      </div>

      {/* Report Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">{renderTableHeaders()}</thead>
          <tbody>{renderTableRows()}</tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomReports;
