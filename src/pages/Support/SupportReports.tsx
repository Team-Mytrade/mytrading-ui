import React, { useState, useMemo } from "react";

interface SupportTicket {
  id: number;
  subject: string;
  createdDate: string; // ISO date string
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  priority: "Low" | "Medium" | "High" | "Critical";
  assignedTo: string;
}

const sampleTickets: SupportTicket[] = [
  {
    id: 1,
    subject: "Login issues",
    createdDate: "2025-07-01",
    status: "Open",
    priority: "High",
    assignedTo: "John Doe",
  },
  {
    id: 2,
    subject: "Payment failed",
    createdDate: "2025-07-05",
    status: "Resolved",
    priority: "Critical",
    assignedTo: "Jane Smith",
  },
  {
    id: 3,
    subject: "UI bug on dashboard",
    createdDate: "2025-07-10",
    status: "In Progress",
    priority: "Medium",
    assignedTo: "Alice Johnson",
  },
  // Add more sample data here...
];

const PAGE_SIZE = 5;

const SupportReports: React.FC = () => {
  const [tickets] = useState<SupportTicket[]>(sampleTickets);
  const [filterStatus, setFilterStatus] = useState<"All" | SupportTicket["status"]>("All");
  const [filterPriority, setFilterPriority] = useState<"All" | SupportTicket["priority"]>("All");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const statusMatch = filterStatus === "All" || ticket.status === filterStatus;
      const priorityMatch = filterPriority === "All" || ticket.priority === filterPriority;

      const ticketDate = new Date(ticket.createdDate).getTime();
      const start = startDate ? new Date(startDate).getTime() : null;
      const end = endDate ? new Date(endDate).getTime() : null;

      const dateMatch =
        (!start || ticketDate >= start) && (!end || ticketDate <= end);

      return statusMatch && priorityMatch && dateMatch;
    });
  }, [tickets, filterStatus, filterPriority, startDate, endDate]);

  const totalPages = Math.ceil(filteredTickets.length / PAGE_SIZE);
  const pageTickets = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        Support Reports
      </h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          className="input input-bordered"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          className="input input-bordered"
          value={filterPriority}
          onChange={(e) => {
            setFilterPriority(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="All">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        <input
          type="date"
          className="input input-bordered"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          placeholder="Start date"
        />

        <input
          type="date"
          className="input input-bordered"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          placeholder="End date"
        />
      </div>

      {/* Tickets Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Created Date</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Priority</th>
              <th className="px-4 py-2 text-left">Assigned To</th>
            </tr>
          </thead>
          <tbody>
            {pageTickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">
                  No tickets found.
                </td>
              </tr>
            ) : (
              pageTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-meta-3"
                >
                  <td className="px-4 py-2">{ticket.subject}</td>
                  <td className="px-4 py-2">{ticket.createdDate}</td>
                  <td className="px-4 py-2">{ticket.status}</td>
                  <td className="px-4 py-2">{ticket.priority}</td>
                  <td className="px-4 py-2">{ticket.assignedTo}</td>
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

export default SupportReports;
