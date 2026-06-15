import React, { useState } from 'react';

interface Call {
  id: number;
  contact: string;
  type: 'Inbound' | 'Outbound';
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  duration: string; // in minutes
  status: 'Completed' | 'Missed';
  notes?: string;
}

const CallsPage: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [formData, setFormData] = useState<Omit<Call, 'id'>>({
    contact: '',
    type: 'Inbound',
    date: '',
    time: '',
    duration: '',
    status: 'Completed',
    notes: '',
  });
  const [filter, setFilter] = useState<'all' | 'Completed' | 'Missed'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData({
      contact: '',
      type: 'Inbound',
      date: '',
      time: '',
      duration: '',
      status: 'Completed',
      notes: '',
    });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact || !formData.date || !formData.time) return;

    if (editingId) {
      setCalls((prev) =>
        prev.map((c) =>
          c.id === editingId ? { ...c, ...formData } : c
        )
      );
    } else {
      setCalls([
        {
          id: Date.now(),
          ...formData,
        },
        ...calls,
      ]);
    }

    resetForm();
  };

  const handleEdit = (call: Call) => {
    setFormData({ ...call });
    setEditingId(call.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this call record?')) {
      setCalls(calls.filter((c) => c.id !== id));
    }
  };

  const filteredCalls = filter === 'all' ? calls : calls.filter((c) => c.status === filter);

  return (
    <div className="max-w-5xl mx-auto p-6 mt-10 bg-white dark:bg-boxdark border border-stroke dark:border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Call Logs</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input
          name="contact"
          placeholder="Contact Name"
          value={formData.contact}
          onChange={handleInputChange}
          className="input input-bordered w-full"
          required
        />
        <select
          name="type"
          value={formData.type}
          onChange={handleInputChange}
          className="input input-bordered w-full"
        >
          <option>Inbound</option>
          <option>Outbound</option>
        </select>
        <input
          name="duration"
          placeholder="Duration (min)"
          value={formData.duration}
          onChange={handleInputChange}
          className="input input-bordered w-full"
        />
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleInputChange}
          className="input input-bordered w-full"
          required
        />
        <input
          type="time"
          name="time"
          value={formData.time}
          onChange={handleInputChange}
          className="input input-bordered w-full"
          required
        />
        <select
          name="status"
          value={formData.status}
          onChange={handleInputChange}
          className="input input-bordered w-full"
        >
          <option>Completed</option>
          <option>Missed</option>
        </select>
        <textarea
          name="notes"
          placeholder="Notes"
          value={formData.notes}
          onChange={handleInputChange}
          className="input input-bordered w-full col-span-full"
        />
        <div className="col-span-full flex gap-2">
          <button type="submit" className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark">
            {editingId ? 'Update Call' : 'Add Call'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-gray-500 underline">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        {(['all', 'Completed', 'Missed'] as const).map((status) => (
          <button
            key={status}
            className={`px-4 py-1 rounded border ${
              filter === status ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Call List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCalls.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-4">No call records found.</td>
              </tr>
            )}
            {filteredCalls.map((call) => (
              <tr key={call.id} className="border-t">
                <td className="px-4 py-2">{call.contact}</td>
                <td className="px-4 py-2">{call.type}</td>
                <td className="px-4 py-2">{call.date}</td>
                <td className="px-4 py-2">{call.time}</td>
                <td className="px-4 py-2">{call.duration} min</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    call.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {call.status}
                  </span>
                </td>
                <td className="px-4 py-2 flex gap-2 text-sm">
                  <button onClick={() => handleEdit(call)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(call.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CallsPage;
