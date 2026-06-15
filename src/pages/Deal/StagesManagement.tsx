import React, { useState } from 'react';

interface Stage {
  id: number;
  name: string;
  order: number;
  color: string;
}

const StagesManagement: React.FC = () => {
  const [stages, setStages] = useState<Stage[]>([
    { id: 1, name: 'Prospecting', order: 1, color: '#2563EB' },
    { id: 2, name: 'Qualified', order: 2, color: '#10B981' },
    { id: 3, name: 'Proposal', order: 3, color: '#F59E0B' },
    { id: 4, name: 'Negotiation', order: 4, color: '#8B5CF6' },
    { id: 5, name: 'Closed Won', order: 5, color: '#22C55E' },
    { id: 6, name: 'Closed Lost', order: 6, color: '#EF4444' },
  ]);

  const [formData, setFormData] = useState<Omit<Stage, 'id'>>({
    name: '',
    order: stages.length + 1,
    color: '#000000',
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'order' ? parseInt(value) : value,
    }));
  };

  const resetForm = () => {
    setFormData({ name: '', order: stages.length + 1, color: '#000000' });
    setEditingId(null);
  };

  const handleAddStage = (e: React.FormEvent) => {
    e.preventDefault();
    const newStage: Stage = {
      id: Date.now(),
      ...formData,
    };
    setStages([...stages, newStage].sort((a, b) => a.order - b.order));
    resetForm();
  };

  const handleEditStage = (stage: Stage) => {
    setFormData({ name: stage.name, order: stage.order, color: stage.color });
    setEditingId(stage.id);
  };

  const handleUpdateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    const updated = stages.map((stage) =>
      stage.id === editingId ? { id: editingId, ...formData } : stage
    );
    setStages(updated.sort((a, b) => a.order - b.order));
    resetForm();
  };

  const handleDeleteStage = (id: number) => {
    if (confirm('Delete this stage?')) {
      setStages(stages.filter((s) => s.id !== id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-boxdark border border-stroke dark:border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        Stages Management
      </h2>

      {/* Form */}
      <form
        onSubmit={editingId === null ? handleAddStage : handleUpdateStage}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
      >
        <input
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="Stage Name"
          className="input input-bordered w-full"
          required
        />
        <input
          name="order"
          type="number"
          value={formData.order}
          onChange={handleInputChange}
          placeholder="Order"
          className="input input-bordered w-full"
          required
        />
        <input
          name="color"
          type="color"
          value={formData.color}
          onChange={handleInputChange}
          className="w-full h-10 border rounded"
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {editingId === null ? 'Add Stage' : 'Update Stage'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-600 underline"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Color</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.id} className="border-t">
                <td className="px-4 py-2">{stage.name}</td>
                <td className="px-4 py-2">{stage.order}</td>
                <td className="px-4 py-2">
                  <span
                    className="inline-block w-5 h-5 rounded-full border"
                    style={{ backgroundColor: stage.color }}
                  />
                </td>
                <td className="px-4 py-2 space-x-2">
                  <button
                    onClick={() => handleEditStage(stage)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {stages.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                  No stages defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StagesManagement;
