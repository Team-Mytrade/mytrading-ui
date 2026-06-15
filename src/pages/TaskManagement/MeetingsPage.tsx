import React, { useState } from 'react';

interface Meeting {
  id: number;
  title: string;
  contact: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  location: string;
  completed: boolean;
  notes?: string;
}

const MeetingsPage: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [formData, setFormData] = useState<Omit<Meeting, 'id' | 'completed'>>({
    title: '',
    contact: '',
    date: '',
    time: '',
    location: '',
    notes: '',
  });
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);

  const now = new Date();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData({ title: '', contact: '', date: '', time: '', location: '', notes: '' });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) return;

    if (editingId) {
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? { ...m, ...formData }
            : m
        )
      );
    } else {
      setMeetings([
        {
          id: Date.now(),
          ...formData,
          completed: false,
        },
        ...meetings,
      ]);
    }

    resetForm();
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this meeting?')) {
      setMeetings(meetings.filter((m) => m.id !== id));
    }
  };

  const handleEdit = (meeting: Meeting) => {
    setFormData({
      title: meeting.title,
      contact: meeting.contact,
      date: meeting.date,
      time: meeting.time,
      location: meeting.location,
      notes: meeting.notes || '',
    });
    setEditingId(meeting.id);
  };

  const toggleComplete = (id: number) => {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, completed: !m.completed } : m
      )
    );
  };

  const filteredMeetings = meetings.filter((m) => {
    const meetingDate = new Date(`${m.date}T${m.time}`);
    if (filter === 'upcoming') return meetingDate > now;
    if (filter === 'past') return meetingDate < now;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto p-6 mt-10 bg-white dark:bg-boxdark border border-stroke dark:border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Meetings</h2>

      {/* Meeting Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input
          name="title"
          placeholder="Meeting Title"
          value={formData.title}
          onChange={handleInputChange}
          className="input input-bordered w-full"
          required
        />
        <input
          name="contact"
          placeholder="Contact Name"
          value={formData.contact}
          onChange={handleInputChange}
          className="input input-bordered w-full"
        />
        <input
          name="location"
          placeholder="Location"
          value={formData.location}
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
        <textarea
          name="notes"
          placeholder="Notes"
          value={formData.notes}
          onChange={handleInputChange}
          className="input input-bordered w-full col-span-full"
        />

        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {editingId ? 'Update Meeting' : 'Add Meeting'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-500 underline"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Filter */}
      <div className="flex gap-4 mb-4">
        {(['all', 'upcoming', 'past'] as const).map((f) => (
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

      {/* Meeting List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Date/Time</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeetings.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-4">
                  No meetings found.
                </td>
              </tr>
            )}
            {filteredMeetings.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2">{m.title}</td>
                <td className="px-4 py-2">{m.contact}</td>
                <td className="px-4 py-2">
                  {m.date} @ {m.time}
                </td>
                <td className="px-4 py-2">{m.location}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      m.completed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {m.completed ? 'Completed' : 'Scheduled'}
                  </span>
                </td>
                <td className="px-4 py-2 flex gap-2 text-sm">
                  <button onClick={() => toggleComplete(m.id)} className="text-green-600 hover:underline">
                    {m.completed ? 'Undo' : 'Done'}
                  </button>
                  <button onClick={() => handleEdit(m)} className="text-blue-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:underline">
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

export default MeetingsPage;
