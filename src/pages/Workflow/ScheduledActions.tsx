import React, { useState, useMemo } from "react";

interface ScheduledAction {
  id: number;
  actionName: string;
  scheduledAt: string; // ISO datetime string
  status: "Pending" | "Completed" | "Cancelled";
}

const sampleScheduledActions: ScheduledAction[] = [
  {
    id: 1,
    actionName: "Send Welcome Email",
    scheduledAt: "2025-08-09T14:00:00Z",
    status: "Pending",
  },
  {
    id: 2,
    actionName: "Update Lead Status",
    scheduledAt: "2025-08-08T09:30:00Z",
    status: "Completed",
  },
  {
    id: 3,
    actionName: "Follow-up SMS",
    scheduledAt: "2025-08-10T16:15:00Z",
    status: "Pending",
  },
  {
    id: 4,
    actionName: "Generate Report",
    scheduledAt: "2025-08-07T20:00:00Z",
    status: "Cancelled",
  },
];

const PAGE_SIZE = 5;

const ScheduledActions: React.FC = () => {
  const [actions, setActions] = useState<ScheduledAction[]>(sampleScheduledActions);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<keyof ScheduledAction>("scheduledAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Sort handler
  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "scheduledAt") {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [actions, sortField, sortDirection]);

  // Pagination slice
  const paginatedActions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedActions.slice(start, start + PAGE_SIZE);
  }, [sortedActions, page]);

  const totalPages = Math.ceil(actions.length / PAGE_SIZE);

  // Change sort column & direction
  const changeSort = (field: keyof ScheduledAction) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Cancel action handler (just updates status here)
  const cancelAction = (id: number) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "Cancelled" } : a))
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Scheduled Actions</h2>

      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100 cursor-pointer select-none">
          <tr>
            <th
              className="px-4 py-2 text-left"
              onClick={() => changeSort("actionName")}
            >
              Action Name{" "}
              {sortField === "actionName" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="px-4 py-2 text-left"
              onClick={() => changeSort("scheduledAt")}
            >
              Scheduled At{" "}
              {sortField === "scheduledAt" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="px-4 py-2 text-center"
              onClick={() => changeSort("status")}
            >
              Status {sortField === "status" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedActions.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-500">
                No scheduled actions found.
              </td>
            </tr>
          ) : (
            paginatedActions.map(({ id, actionName, scheduledAt, status }) => (
              <tr key={id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{actionName}</td>
                <td className="px-4 py-2">{new Date(scheduledAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`font-semibold ${
                      status === "Completed"
                        ? "text-green-600"
                        : status === "Cancelled"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  {status === "Pending" ? (
                    <button
                      onClick={() => cancelAction(id)}
                      className="btn btn-error btn-sm"
                      title="Cancel Action"
                    >
                      Cancel
                    </button>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
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

export default ScheduledActions;
