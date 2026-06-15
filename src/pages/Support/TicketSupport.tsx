import React, { useState, useMemo } from 'react';

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Closed';
  priority: 'Low' | 'Medium' | 'High';
  assignedTo: string;
  createdAt: string; // ISO date
}

const sampleTickets: Ticket[] = [
  {
    id: 1,
    subject: 'Login issue',
    description: 'User unable to login with correct password.',
    status: 'Open',
    priority: 'High',
    assignedTo: 'Alice',
    createdAt: '2025-08-01T10:00:00Z',
  },
  {
    id: 2,
    subject: 'Feature request: Dark mode',
    description: 'Request to add dark mode to the app.',
    status: 'In Progress',
    priority: 'Medium',
    assignedTo: 'Bob',
    createdAt: '2025-07-28T14:30:00Z',
  },
];

const PAGE_SIZE = 5;

const TicketSupport: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>(sampleTickets);
  const [filterStatus, setFilterStatus] = useState<'All' | Ticket['status']>('All');
  const [filterPriority, setFilterPriority] = useState<'All' | Ticket['priority']>('All');
  const [page, setPage] = useState(1);

  // Form states
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Ticket, 'id' | 'createdAt'>>({
    subject: '',
    description: '',
    status: 'Open',
    priority: 'Low',
    assignedTo: '',
  });

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const statusMatch = filterStatus === 'All' || t.status === filterStatus;
      const priorityMatch = filterPriority === 'All' || t.priority === filterPriority;
      return statusMatch && priorityMatch;
    });
  }, [tickets, filterStatus, filterPriority]);

  const totalPages = Math.ceil(filteredTickets.length / PAGE_SIZE);
  const pageTickets = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetForm = () => {
    setFormData({
      subject: '',
      description: '',
      status: 'Open',
      priority: 'Low',
      assignedTo: '',
    });
    setFormMode(null);
    setEditingTicketId(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      alert('Subject is required');
      return;
    }
    if (!formData.assignedTo.trim()) {
      alert('Assigned To is required');
      return;
    }

    if (formMode === 'add') {
      const newTicket: Ticket = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        ...formData,
      };
      setTickets((prev) => [newTicket, ...prev]);
    } else if (formMode === 'edit' && editingTicketId !== null) {
      setTickets((prev) =>
        prev.map((t) => (t.id === editingTicketId ? { ...t, ...formData } : t))
      );
    }

    resetForm();
  };

  const handleEdit = (ticket: Ticket) => {
    setFormData({
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo,
    });
    setFormMode('edit');
    setEditingTicketId(ticket.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this ticket?')) {
      setTickets((prev) => prev.filter((t) => t.id !== id));
      if (editingTicketId === id) resetForm();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Ticket Support</h2>

      {/* Filter */}
      <div className="flex gap-4 mb-4">
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
        </select>

        <button
          className="btn btn-primary ml-auto"
          onClick={() => {
            resetForm();
            setFormMode('add');
          }}
        >
          + New Ticket
        </button>
      </div>

      {/* Ticket List */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Priority</th>
              <th className="px-4 py-2 text-left">Assigned To</th>
              <th className="px-4 py-2 text-left">Created At</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageTickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">
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
                  <td className="px-4 py-2">{ticket.status}</td>
                  <td className="px-4 py-2">{ticket.priority}</td>
                  <td className="px-4 py-2">{ticket.assignedTo}</td>
                  <td className="px-4 py-2">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(ticket)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ticket.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mb-6">
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

      {/* Add/Edit Form */}
      {(formMode === 'add' || formMode === 'edit') && (
        <form
          onSubmit={handleSubmit}
          className="border border-stroke rounded p-4 bg-gray-50 dark:bg-meta-2"
        >
          <h3 className="text-xl font-semibold mb-4">
            {formMode === 'add' ? 'Add New Ticket' : 'Edit Ticket'}
          </h3>

          <label className="block mb-2 font-semibold">Subject</label>
          <input
            name="subject"
            type="text"
            className="input input-bordered w-full mb-4"
            value={formData.subject}
            onChange={handleInputChange}
            required
          />

          <label className="block mb-2 font-semibold">Description</label>
          <textarea
            name="description"
            className="input input-bordered w-full mb-4 resize-y"
            rows={4}
            value={formData.description}
            onChange={handleInputChange}
          />

          <label className="block mb-2 font-semibold">Status</label>
          <select
            name="status"
            className="input input-bordered w-full mb-4"
            value={formData.status}
            onChange={handleInputChange}
          >
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
          </select>

          <label className="block mb-2 font-semibold">Priority</label>
          <select
            name="priority"
            className="input input-bordered w-full mb-4"
            value={formData.priority}
            onChange={handleInputChange}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>

          <label className="block mb-2 font-semibold">Assigned To</label>
          <input
            name="assignedTo"
            type="text"
            className="input input-bordered w-full mb-4"
            value={formData.assignedTo}
            onChange={handleInputChange}
            required
          />

          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">
              {formMode === 'add' ? 'Add Ticket' : 'Update Ticket'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default TicketSupport;
