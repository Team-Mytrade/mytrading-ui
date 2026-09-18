import React, { useState, useMemo } from "react";

interface Lead {
  id: number;
  name: string;
  source: string;
  status: "New" | "Contacted" | "Qualified" | "Lost" | "Converted";
  createdDate: string; // ISO date string
  value: number; // Potential revenue
}

const sampleLeads: Lead[] = [
  {
    id: 1,
    name: "Acme Corp",
    source: "Website",
    status: "New",
    createdDate: "2025-07-01",
    value: 5000,
  },
  {
    id: 2,
    name: "Beta Ltd",
    source: "Referral",
    status: "Contacted",
    createdDate: "2025-07-05",
    value: 12000,
  },
  {
    id: 3,
    name: "Gamma Inc",
    source: "Trade Show",
    status: "Qualified",
    createdDate: "2025-07-10",
    value: 8000,
  },
  // ...more sample leads
];

const PAGE_SIZE = 5;

type SortField = "name" | "createdDate" | "value";
type SortOrder = "asc" | "desc";

const LeadReports: React.FC = () => {
  const [leads] = useState<Lead[]>(sampleLeads);
  const [filterSource, setFilterSource] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);

  const [sortField, setSortField] = useState<SortField>("createdDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const sourceMatch = filterSource === "All" || lead.source === filterSource;
      const statusMatch = filterStatus === "All" || lead.status === filterStatus;

      const leadDate = new Date(lead.createdDate).getTime();
      const start = startDate ? new Date(startDate).getTime() : null;
      const end = endDate ? new Date(endDate).getTime() : null;
      const dateMatch =
        (!start || leadDate >= start) && (!end || leadDate <= end);

      return sourceMatch && statusMatch && dateMatch;
    });
  }, [leads, filterSource, filterStatus, startDate, endDate]);

  // Sort leads
  const sortedLeads = useMemo(() => {
    return filteredLeads.slice().sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "createdDate") {
        cmp = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
      } else if (sortField === "value") {
        cmp = a.value - b.value;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filteredLeads, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedLeads.length / PAGE_SIZE);
  const pageLeads = sortedLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary
  const totalLeads = filteredLeads.length;
  const totalValue = filteredLeads.reduce((acc, l) => acc + l.value, 0);
  const leadsByStatus = filteredLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const sources = Array.from(new Set(leads.map((l) => l.source)));

  // Handle sort toggling
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
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Lead Reports Analysis</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <select
          className="input input-bordered"
          value={filterSource}
          onChange={(e) => {
            setFilterSource(e.target.value);
            setPage(1);
          }}
        >
          <option value="All">All Sources</option>
          {sources.map((src) => (
            <option key={src} value={src}>{src}</option>
          ))}
        </select>

        <select
          className="input input-bordered"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="All">All Statuses</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
          <option value="Lost">Lost</option>
          <option value="Converted">Converted</option>
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
          <div className="text-3xl font-bold">{totalLeads}</div>
          <div>Total Leads</div>
        </div>
        <div className="bg-blue-100 rounded p-4">
          <div className="text-3xl font-bold">${totalValue.toLocaleString()}</div>
          <div>Total Potential Value</div>
        </div>
        <div className="bg-yellow-100 rounded p-4">
          <div className="text-lg font-semibold mb-2">Leads by Status</div>
          {Object.entries(leadsByStatus).map(([status, count]) => (
            <div key={status} className="flex justify-between px-4">
              <span>{status}</span>
              <span>{count}</span>
            </div>
          ))}
          {Object.keys(leadsByStatus).length === 0 && <div>No leads</div>}
        </div>
      </div>

      {/* Lead Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4 cursor-pointer select-none">
            <tr>
              <th
                className="px-4 py-2 text-left"
                onClick={() => handleSort("name")}
              >
                Name {sortField === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left">Source</th>
              <th
                className="px-4 py-2 text-left"
                onClick={() => handleSort("createdDate")}
              >
                Created Date {sortField === "createdDate" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left">Status</th>
              <th
                className="px-4 py-2 text-left"
                onClick={() => handleSort("value")}
              >
                Potential Value {sortField === "value" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageLeads.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">
                  No leads found.
                </td>
              </tr>
            ) : (
              pageLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-meta-3"
                >
                  <td className="px-4 py-2">{lead.name}</td>
                  <td className="px-4 py-2">{lead.source}</td>
                  <td className="px-4 py-2">{lead.createdDate}</td>
                  <td className="px-4 py-2">{lead.status}</td>
                  <td className="px-4 py-2">${lead.value.toLocaleString()}</td>
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

export default LeadReports;
