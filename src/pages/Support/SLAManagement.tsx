import React, { useState, useMemo } from 'react';

interface SLA {
  id: number;
  name: string;
  description: string;
  responseTime: string; // e.g. "4 hours"
  resolutionTime: string; // e.g. "24 hours"
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Active' | 'Inactive';
}

const sampleSLAs: SLA[] = [
  {
    id: 1,
    name: 'Standard Support',
    description: 'Response within 4 hours, resolution within 24 hours.',
    responseTime: '4 hours',
    resolutionTime: '24 hours',
    priority: 'Medium',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Premium Support',
    description: 'Response within 1 hour, resolution within 4 hours.',
    responseTime: '1 hour',
    resolutionTime: '4 hours',
    priority: 'High',
    status: 'Active',
  },
];

const PAGE_SIZE = 5;

const SLAManagement: React.FC = () => {
  const [slas, setSlas] = useState<SLA[]>(sampleSLAs);
  const [filterPriority, setFilterPriority] = useState<'All' | SLA['priority']>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | SLA['status']>('All');
  const [page, setPage] = useState(1);

  // Form states
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<SLA, 'id'>>({
    name: '',
    description: '',
    responseTime: '',
    resolutionTime: '',
    priority: 'Low',
    status: 'Active',
  });

  const filteredSLAs = useMemo(() => {
    return slas.filter((s) => {
      const priorityMatch = filterPriority === 'All' || s.priority === filterPriority;
      const statusMatch = filterStatus === 'All' || s.status === filterStatus;
      return priorityMatch && statusMatch;
    });
  }, [slas, filterPriority, filterStatus]);

  const totalPages = Math.ceil(filteredSLAs.length / PAGE_SIZE);
  const pageSLAs = filteredSLAs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      responseTime: '',
      resolutionTime: '',
      priority: 'Low',
      status: 'Active',
    });
    setFormMode(null);
    setEditingId(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }
    if (!formData.responseTime.trim() || !formData.resolutionTime.trim()) {
      alert('Response and resolution times are required');
      return;
    }
    if (formMode === 'add') {
      const newSLA: SLA = {
        id: Date.now(),
        ...formData,
      };
      setSlas((prev) => [newSLA, ...prev]);
    } else if (formMode === 'edit' && editingId !== null) {
      setSlas((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...formData } : s)));
    }
    resetForm();
  };

  const handleEdit = (sla: SLA) => {
    setFormData({
      name: sla.name,
      description: sla.description,
      responseTime: sla.responseTime,
      resolutionTime: sla.resolutionTime,
      priority: sla.priority,
      status: sla.status,
    });
    setEditingId(sla.id);
    setFormMode('edit');
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this SLA?')) {
      setSlas((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) resetForm();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">SLA Management</h2>

      {/* Filters and Add */}
      <div className="flex gap-4 mb-4 items-center">
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

        <select
          className="input input-bordered"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <button
          className="btn btn-primary ml-auto"
          onClick={() => {
            resetForm();
            setFormMode('add');
          }}
        >
          + New SLA
        </button>
      </div>

      {/* SLA Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left">Response Time</th>
              <th className="px-4 py-2 text-left">Resolution Time</th>
              <th className="px-4 py-2 text-left">Priority</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageSLAs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4 text-gray-500">
                  No SLAs found.
                </td>
              </tr>
            ) : (
              pageSLAs.map((sla) => (
                <tr
                  key={sla.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-meta-3"
                >
                  <td className="px-4 py-2">{sla.name}</td>
                  <td className="px-4 py-2">{sla.description}</td>
                  <td className="px-4 py-2">{sla.responseTime}</td>
                  <td className="px-4 py-2">{sla.resolutionTime}</td>
                  <td className="px-4 py-2">{sla.priority}</td>
                  <td className="px-4 py-2">{sla.status}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(sla)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sla.id)}
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
            {formMode === 'add' ? 'Add New SLA' : 'Edit SLA'}
          </h3>

          <label className="block mb-2 font-semibold">Name</label>
          <input
            name="name"
            type="text"
            className="input input-bordered w-full mb-4"
            value={formData.name}
            onChange={handleInputChange}
            required
          />

          <label className="block mb-2 font-semibold">Description</label>
          <textarea
            name="description"
            className="input input-bordered w-full mb-4 resize-y"
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
          />

          <label className="block mb-2 font-semibold">Response Time</label>
          <input
            name="responseTime"
            type="text"
            placeholder="e.g. 4 hours"
            className="input input-bordered w-full mb-4"
            value={formData.responseTime}
            onChange={handleInputChange}
            required
          />

          <label className="block mb-2 font-semibold">Resolution Time</label>
          <input
            name="resolutionTime"
            type="text"
            placeholder="e.g. 24 hours"
            className="input input-bordered w-full mb-4"
            value={formData.resolutionTime}
            onChange={handleInputChange}
            required
          />

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
            <option value="Critical">Critical</option>
          </select>

          <label className="block mb-2 font-semibold">Status</label>
          <select
            name="status"
            className="input input-bordered w-full mb-4"
            value={formData.status}
            onChange={handleInputChange}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">
              {formMode === 'add' ? 'Add SLA' : 'Update SLA'}
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SLAManagement;
