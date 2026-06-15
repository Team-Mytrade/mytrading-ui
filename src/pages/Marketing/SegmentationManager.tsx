import React, { useState } from 'react';

interface Segment {
  id: number;
  name: string;
  criteria: { field: string; operator: string; value: string }[];
}

const fields = ['Country', 'Status', 'Lead Source', 'Industry'];
const operators = ['=', '!=', 'contains', 'does not contain'];

const SegmentationManager: React.FC = () => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentName, setSegmentName] = useState('');
  const [criteria, setCriteria] = useState<
    { field: string; operator: string; value: string }[]
  >([{ field: 'Country', operator: '=', value: '' }]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const resetForm = () => {
    setSegmentName('');
    setCriteria([{ field: 'Country', operator: '=', value: '' }]);
    setEditingId(null);
  };

  const handleAddCriteria = () => {
    setCriteria([...criteria, { field: 'Country', operator: '=', value: '' }]);
  };

  const handleRemoveCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleCriteriaChange = (
    index: number,
    key: 'field' | 'operator' | 'value',
    value: string
  ) => {
    const newCriteria = [...criteria];
    newCriteria[index][key] = value;
    setCriteria(newCriteria);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentName.trim()) {
      alert('Segment name is required');
      return;
    }
    if (criteria.some((c) => !c.value.trim())) {
      alert('All criteria must have values');
      return;
    }
    const newSegment: Segment = { id: editingId ?? Date.now(), name: segmentName, criteria };
    if (editingId !== null) {
      setSegments(segments.map((s) => (s.id === editingId ? newSegment : s)));
    } else {
      setSegments([newSegment, ...segments]);
    }
    resetForm();
  };

  const handleEdit = (segment: Segment) => {
    setSegmentName(segment.name);
    setCriteria(segment.criteria.length ? segment.criteria : [{ field: 'Country', operator: '=', value: '' }]);
    setEditingId(segment.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this segment?')) {
      setSegments(segments.filter((s) => s.id !== id));
      if (editingId === id) resetForm();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Segmentation Manager</h2>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <input
          type="text"
          placeholder="Segment Name"
          className="input input-bordered w-full"
          value={segmentName}
          onChange={(e) => setSegmentName(e.target.value)}
          required
        />

        <div>
          {criteria.map((crit, index) => (
            <div key={index} className="flex gap-2 mb-2 items-center">
              <select
                className="input input-bordered w-1/4"
                value={crit.field}
                onChange={(e) => handleCriteriaChange(index, 'field', e.target.value)}
              >
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <select
                className="input input-bordered w-1/4"
                value={crit.operator}
                onChange={(e) => handleCriteriaChange(index, 'operator', e.target.value)}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="input input-bordered w-1/2"
                placeholder="Value"
                value={crit.value}
                onChange={(e) => handleCriteriaChange(index, 'value', e.target.value)}
                required
              />

              {criteria.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveCriteria(index)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddCriteria}
          className="text-blue-600 hover:underline mb-4"
        >
          + Add Criteria
        </button>

        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {editingId !== null ? 'Update' : 'Add'} Segment
          </button>
          {editingId !== null && (
            <button
              onClick={resetForm}
              type="button"
              className="text-gray-500 underline"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Segments List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Segment Name</th>
              <th className="px-4 py-2 text-left">Criteria</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {segments.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-gray-500 py-4">
                  No segments created yet.
                </td>
              </tr>
            ) : (
              segments.map((seg) => (
                <tr key={seg.id} className="border-t">
                  <td className="px-4 py-2">{seg.name}</td>
                  <td className="px-4 py-2">
                    {seg.criteria.map((c, i) => (
                      <div key={i}>
                        {c.field} {c.operator} "{c.value}"
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2 flex gap-2 text-sm">
                    <button
                      onClick={() => handleEdit(seg)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(seg.id)}
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

export default SegmentationManager;
