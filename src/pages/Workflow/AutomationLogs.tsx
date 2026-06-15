import React, { useState, useMemo } from "react";

interface AutomationLog {
  id: number;
  workflowName: string;
  triggeredAt: string; // ISO date string
  status: "Success" | "Failed" | "Pending";
  details: string;
}

const sampleLogs: AutomationLog[] = [
  {
    id: 1,
    workflowName: "Lead Created Notification",
    triggeredAt: "2025-08-07T10:15:00Z",
    status: "Success",
    details: "Email sent to sales team.",
  },
  {
    id: 2,
    workflowName: "Deal Won Follow-up",
    triggeredAt: "2025-08-07T09:50:00Z",
    status: "Failed",
    details: "Failed to send SMS.",
  },
  {
    id: 3,
    workflowName: "Account Update Alert",
    triggeredAt: "2025-08-06T17:30:00Z",
    status: "Pending",
    details: "Queued for processing.",
  },
  // ...more logs
];

const PAGE_SIZE = 5;

const AutomationLogs: React.FC = () => {
  const [logs] = useState<AutomationLog[]>(sampleLogs);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<keyof AutomationLog>("triggeredAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "triggeredAt") {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [logs, sortField, sortDirection]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedLogs.slice(start, start + PAGE_SIZE);
  }, [sortedLogs, page]);

  const totalPages = Math.ceil(logs.length / PAGE_SIZE);

  const changeSort = (field: keyof AutomationLog) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Automation Logs</h2>

      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100 cursor-pointer select-none">
          <tr>
            <th
              className="px-4 py-2 text-left"
              onClick={() => changeSort("workflowName")}
            >
              Workflow Name{" "}
              {sortField === "workflowName" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="px-4 py-2 text-left"
              onClick={() => changeSort("triggeredAt")}
            >
              Triggered At{" "}
              {sortField === "triggeredAt" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="px-4 py-2 text-center"
              onClick={() => changeSort("status")}
            >
              Status {sortField === "status" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="px-4 py-2 text-left">Details</th>
          </tr>
        </thead>
        <tbody>
          {paginatedLogs.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-500">
                No logs found.
              </td>
            </tr>
          ) : (
            paginatedLogs.map(({ id, workflowName, triggeredAt, status, details }) => (
              <tr key={id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{workflowName}</td>
                <td className="px-4 py-2">
                  {new Date(triggeredAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`font-semibold ${
                      status === "Success"
                        ? "text-green-600"
                        : status === "Failed"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-4 py-2">{details}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="mt-4 flex justify-center space-x-2">
        <button
          className="btn btn-outline px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Prev
        </button>
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            className={`btn px-3 py-1 ${
              page === i + 1 ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <button
          className="btn btn-outline px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AutomationLogs;
