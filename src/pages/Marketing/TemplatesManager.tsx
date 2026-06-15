import React, { useState } from 'react';

interface Template {
  id: number;
  name: string;
  content: string;
  type: 'Email' | 'SMS';
}

const TemplatesManager: React.FC<{
  onSelectTemplate?: (template: Template) => void;
}> = ({ onSelectTemplate }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<Omit<Template, 'id'>>({
    name: '',
    content: '',
    type: 'Email',
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const resetForm = () => {
    setForm({ name: '', content: '', type: 'Email' });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) {
      alert('Please fill in all fields');
      return;
    }
    const newTemplate = { id: editingId ?? Date.now(), ...form };
    if (editingId !== null) {
      setTemplates(templates.map((t) => (t.id === editingId ? newTemplate : t)));
    } else {
      setTemplates([newTemplate, ...templates]);
    }
    resetForm();
  };

  const handleEdit = (template: Template) => {
    setForm({ name: template.name, content: template.content, type: template.type });
    setEditingId(template.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this template?')) {
      setTemplates(templates.filter((t) => t.id !== id));
      if (editingId === id) resetForm();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Templates Manager</h2>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Template Name"
            className="input input-bordered w-full"
            required
          />
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="input input-bordered w-full"
          >
            <option value="Email">Email</option>
            <option value="SMS">SMS</option>
          </select>
        </div>

        <textarea
          name="content"
          value={form.content}
          onChange={handleChange}
          placeholder="Template Content (HTML allowed for Email)"
          rows={5}
          className="input input-bordered w-full"
          required
        />

        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {editingId !== null ? 'Update' : 'Add'} Template
          </button>
          {editingId !== null && (
            <button onClick={resetForm} type="button" className="text-gray-500 underline">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Template List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Preview</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 py-4">
                  No templates available.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2">{t.name}</td>
                  <td className="px-4 py-2">{t.type}</td>
                  <td className="px-4 py-2 max-w-xs truncate" title={t.content}>
                    {t.content}
                  </td>
                  <td className="px-4 py-2 flex gap-2 text-sm">
                    <button
                      onClick={() => handleEdit(t)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                    {onSelectTemplate && (
                      <button
                        onClick={() => onSelectTemplate(t)}
                        className="text-green-600 hover:underline"
                      >
                        Select
                      </button>
                    )}
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

export default TemplatesManager;
