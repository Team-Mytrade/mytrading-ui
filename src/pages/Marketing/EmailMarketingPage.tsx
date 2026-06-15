import React, { useState } from 'react';

interface EmailCampaign {
  id: number;
  name: string;
  subject: string;
  audience: string;
  body: string;
  status: 'Draft' | 'Scheduled' | 'Sent';
  sendDate: string;
  stats?: {
    opens: number;
    clicks: number;
  };
}

const EmailMarketingPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [form, setForm] = useState<Omit<EmailCampaign, 'id' | 'stats'>>({
    name: '',
    subject: '',
    audience: '',
    body: '',
    status: 'Draft',
    sendDate: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const resetForm = () => {
    setForm({
      name: '',
      subject: '',
      audience: '',
      body: '',
      status: 'Draft',
      sendDate: '',
    });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCampaign: EmailCampaign = {
      id: editingId ?? Date.now(),
      ...form,
      stats: form.status === 'Sent'
        ? { opens: Math.floor(Math.random() * 100), clicks: Math.floor(Math.random() * 100) }
        : undefined,
    };

    if (editingId !== null) {
      setCampaigns(campaigns.map((c) => (c.id === editingId ? newCampaign : c)));
    } else {
      setCampaigns([newCampaign, ...campaigns]);
    }
    resetForm();
  };

  const handleEdit = (c: EmailCampaign) => {
    setForm({ ...c });
    setEditingId(c.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this campaign?')) {
      setCampaigns(campaigns.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Email Marketing</h2>

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
          <input
            name="subject"
            value={form.subject}
            onChange={handleChange}
            placeholder="Email Subject"
            className="input input-bordered w-full"
            required
          />
          <select
            name="audience"
            value={form.audience}
            onChange={handleChange}
            className="input input-bordered w-full"
            required
          >
            <option value="">Select Audience</option>
            <option value="Newsletter Subscribers">Newsletter Subscribers</option>
            <option value="Leads">Leads</option>
            <option value="Customers">Customers</option>
          </select>
        </div>

        <textarea
          name="body"
          value={form.body}
          onChange={handleChange}
          placeholder="Email Body"
          rows={5}
          className="input input-bordered w-full"
          required
        />

        <div className="grid md:grid-cols-3 gap-4">
          <input
            type="datetime-local"
            name="sendDate"
            value={form.sendDate}
            onChange={handleChange}
            className="input input-bordered w-full"
            required
          />
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="input input-bordered w-full"
          >
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Sent">Sent</option>
          </select>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {editingId !== null ? 'Update' : 'Add'} Campaign
          </button>
          {editingId !== null && (
            <button onClick={resetForm} type="button" className="text-gray-500 underline">
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
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Audience</th>
              <th className="px-4 py-2 text-left">Send Date</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Stats</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-4">
                  No campaigns yet.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">{c.subject}</td>
                  <td className="px-4 py-2">{c.audience}</td>
                  <td className="px-4 py-2">{new Date(c.sendDate).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        c.status === 'Draft'
                          ? 'bg-gray-200 text-gray-800'
                          : c.status === 'Scheduled'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {c.status === 'Sent' && c.stats ? (
                      <>
                        <div className="text-xs">Opens: {c.stats.opens}%</div>
                        <div className="text-xs">Clicks: {c.stats.clicks}%</div>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">N/A</span>
                    )}
                  </td>
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

export default EmailMarketingPage;
