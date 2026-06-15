import React, { useState } from 'react';

interface Campaign {
  id: number;
  name: string;
  status: 'Planned' | 'Ongoing' | 'Completed';
  startDate: string;
  endDate: string;
  audience: string;
  budget: number;
  notes: string;
}

const CampaignPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState<Omit<Campaign, 'id'>>({
    name: '',
    status: 'Planned',
    startDate: '',
    endDate: '',
    audience: '',
    budget: 0,
    notes: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === 'budget' ? Number(value) : value });
  };

  const resetForm = () => {
    setForm({
      name: '',
      status: 'Planned',
      startDate: '',
      endDate: '',
      audience: '',
      budget: 0,
      notes: '',
    });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      setCampaigns(campaigns.map((c) => (c.id === editingId ? { ...c, ...form } : c)));
    } else {
      setCampaigns([{ id: Date.now(), ...form }, ...campaigns]);
    }
    resetForm();
  };

  const handleEdit = (campaign: Campaign) => {
    setForm({ ...campaign });
    setEditingId(campaign.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      setCampaigns(campaigns.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Marketing Campaigns</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div className="grid md:grid-cols-3 gap-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Campaign Name"
            className="input input-bordered w-full"
            required
          />
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="input input-bordered w-full"
          >
            <option>Planned</option>
            <option>Ongoing</option>
            <option>Completed</option>
          </select>
          <input
            name="audience"
            value={form.audience}
            onChange={handleChange}
            placeholder="Audience (e.g., Email list, Region)"
            className="input input-bordered w-full"
          />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            className="input input-bordered w-full"
            required
          />
          <input
            type="date"
            name="endDate"
            value={form.endDate}
            onChange={handleChange}
            className="input input-bordered w-full"
            required
          />
          <input
            type="number"
            name="budget"
            value={form.budget}
            onChange={handleChange}
            placeholder="Budget"
            className="input input-bordered w-full"
          />
        </div>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Campaign Notes or Description"
          className="input input-bordered w-full"
          rows={3}
        />
        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {editingId !== null ? 'Update' : 'Add'} Campaign
          </button>
          {editingId !== null && (
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Start - End</th>
              <th className="px-4 py-2 text-left">Audience</th>
              <th className="px-4 py-2 text-left">Budget</th>
              <th className="px-4 py-2 text-left">Notes</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-4">
                  No campaigns added yet.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        c.status === 'Planned'
                          ? 'bg-yellow-100 text-yellow-700'
                          : c.status === 'Ongoing'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {c.startDate} → {c.endDate}
                  </td>
                  <td className="px-4 py-2">{c.audience}</td>
                  <td className="px-4 py-2">${c.budget.toLocaleString()}</td>
                  <td className="px-4 py-2">{c.notes}</td>
                  <td className="px-4 py-2 flex gap-2 text-sm">
                    <button
                      onClick={() => handleEdit(c)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
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
    </div>
  );
};

export default CampaignPage;
