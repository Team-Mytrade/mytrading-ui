import React, { useState } from 'react';

interface Reminder {
  id: number;
  title: string;
  date: string;  // YYYY-MM-DD
  time: string;  // HH:mm
  status: 'Pending' | 'Completed';
}

const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [formData, setFormData] = useState<Omit<Reminder, 'id' | 'status'>>({
    title: '',
    date: '',
    time: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  const now = new Date();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData({ title: '', date: '', time: '' });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) return;

    if (editingId) {
      setReminders((prev) =>
        prev.map((rem) =>
          rem.id === editingId ? { ...rem, ...formData } : rem
        )
      );
    } else {
      setReminders([
        {
          id: Date.now(),
          ...formData,
          status: 'Pending',
        },
        ...reminders,
      ]);
    }

    resetForm();
  };

  const toggleStatus = (id: number) => {
    setReminders((prev) =>
      prev.map((rem) =>
        rem.id === id
          ? { ...rem, status: rem.status === 'Pending' ? 'Completed' : 'Pending' }
          : rem
      )
    );
  };

  const handleEdit = (reminder: Reminder) => {
    setFormData({
      title: reminder.title,
      date: reminder.date,
      time: reminder.time,
    });
    setEditingId(reminder.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this reminder?')) {
      setReminders(reminders.filter((r) => r.id !== id));
    }
  };

  const filteredReminders = reminders.filter((rem) => {
    const reminderDate = new Date(`${rem.date}T${rem.time}`);
    if (filter === 'upcoming') return reminderDate > now && rem.status === 'Pending';
    if (filter === 'completed') return rem.status === 'Completed';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-boxdark border border-stroke dark:border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Reminders</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Reminder Title"
          className="input input-bordered w-full"
          required
        />
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <input
          type="time"
          name="time"
          value={formData.time}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {editingId ? 'Update' : 'Add Reminder'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-gray-500 underline">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Filter */}
      <div className="flex gap-4 mb-4">
        {(['all', 'upcoming', 'completed'] as const).map((f) => (
          <button
            key={f}
            className={`px-4 py-1 rounded border ${
              filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Reminders List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReminders.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-4">No reminders found.</td>
              </tr>
            )}
            {filteredReminders.map((rem) => (
              <tr key={rem.id} className="border-t">
                <td className="px-4 py-2">{rem.title}</td>
                <td className="px-4 py-2">{rem.date}</td>
                <td className="px-4 py-2">{rem.time}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      rem.status === 'Completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {rem.status}
                  </span>
                </td>
                <td className="px-4 py-2 flex gap-2 text-sm">
                  <button onClick={() => toggleStatus(rem.id)} className="text-green-600 hover:underline">
                    {rem.status === 'Pending' ? 'Done' : 'Undo'}
                  </button>
                  <button onClick={() => handleEdit(rem)} className="text-blue-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(rem.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RemindersPage;
