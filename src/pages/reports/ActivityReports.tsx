import React, { useState, useMemo } from "react";

interface Activity {
  id: number;
  type: "Call" | "Meeting" | "Task";
  subject: string;
  assignedTo: string;
  date: string; // ISO date string
  status: "Pending" | "Completed" | "Canceled";
  durationMins: number; // duration in minutes (for calls/meetings)
}

const sampleActivities: Activity[] = [
  {
    id: 1,
    type: "Call",
    subject: "Follow-up with Acme Corp",
    assignedTo: "John Doe",
    date: "2025-08-01T10:00:00",
    status: "Completed",
    durationMins: 30,
  },
  {
    id: 2,
    type: "Meeting",
    subject: "Project kickoff with Beta Ltd",
    assignedTo: "Jane Smith",
    date: "2025-08-02T14:00:00",
    status: "Pending",
    durationMins: 60,
  },
  {
    id: 3,
    type: "Task",
    subject: "Prepare proposal for Gamma Inc",
    assignedTo: "John Doe",
    date: "2025-08-03T09:00:00",
    status: "Completed",
    durationMins: 0,
  },
  // add more activities...
];

const PAGE_SIZE = 5;

type SortField = "type" | "subject" | "assignedTo" | "date" | "status" | "durationMins";
type SortOrder = "asc" | "desc";

const ActivityReports: React.FC = () => {
  const [activities] = useState(sampleActivities);

  const [filterType, setFilterType] = useState<"All" | Activity["type"]>("All");
  const [filterStatus, setFilterStatus] = useState<"All" | Activity["status"]>("All");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      const typeMatch = filterType === "All" || a.type === filterType;
      const statusMatch = filterStatus === "All" || a.status === filterStatus;
      const activityDate = new Date(a.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : null;
      const end = endDate ? new Date(endDate).getTime() : null;
      const dateMatch = (!start || activityDate >= start) && (!end || activityDate <= end);
      return typeMatch && statusMatch && dateMatch;
    });
  }, [activities, filterType, filterStatus, startDate, endDate]);

  // Sort activities
  const sortedActivities = useMemo(() => {
    return filteredActivities.slice().sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "subject":
          cmp = a.subject.localeCompare(b.subject);
          break;
        case "assignedTo":
          cmp = a.assignedTo.localeCompare(b.assignedTo);
          break;
        case "date":
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "durationMins":
          cmp = a.durationMins - b.durationMins;
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filteredActivities, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedActivities.length / PAGE_SIZE);
  const pageActivities = sortedActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary stats
  const totalActivities = filteredActivities.length;
  const completedCount = filteredActivities.filter((a) => a.status === "Completed").length;
  const totalDuration = filteredActivities.reduce((acc, a) => acc + a.durationMins, 0);

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Activity Reports</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <select
          className="input input-bordered"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="All">All Types</option>
          <option value="Call">Call</option>
          <option value="Meeting">Meeting</option>
          <option value="Task">Task</option>
        </select>

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
          <option value="Completed">Completed</option>
          <option value="Canceled">Canceled</option>
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
          <div className="text-3xl font-bold">{totalActivities}</div>
          <div>Total Activities</div>
        </div>
        <div className="bg-blue-100 rounded p-4">
          <div className="text-3xl font-bold">{completedCount}</div>
          <div>Completed</div>
        </div>
        <div className="bg-yellow-100 rounded p-4">
          <div className="text-3xl font-bold">{totalDuration} mins</div>
          <div>Total Duration</div>
        </div>
      </div>

      {/* Activity Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4 cursor-pointer select-none">
            <tr>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("type")}>
                Type {sortField === "type" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("subject")}>
                Subject {sortField === "subject" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("assignedTo")}>
                Assigned To {sortField === "assignedTo" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("date")}>
                Date {sortField === "date" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("status")}>
                Status {sortField === "status" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="px-4 py-2 text-left" onClick={() => handleSort("durationMins")}>
                Duration (mins) {sortField === "durationMins" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageActivities.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">
                  No activities found.
                </td>
              </tr>
            ) : (
              pageActivities.map((a) => (
                <tr key={a.id} className="border-t hover:bg-gray-50 dark:hover:bg-meta-3">
                  <td className="px-4 py-2">{a.type}</td>
                  <td className="px-4 py-2">{a.subject}</td>
                  <td className="px-4 py-2">{a.assignedTo}</td>
                  <td className="px-4 py-2">{new Date(a.date).toLocaleString()}</td>
                  <td className="px-4 py-2">{a.status}</td>
                  <td className="px-4 py-2">{a.durationMins}</td>
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

export default ActivityReports;
