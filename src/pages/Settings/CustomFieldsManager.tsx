import React, { useState } from "react";

type FieldType = "text" | "number" | "date" | "select";

interface CustomField {
  id: number;
  label: string;
  type: FieldType;
  options?: string[]; // for select fields
}

const CustomFieldsManager: React.FC = () => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState(""); // comma-separated for select
  const [editId, setEditId] = useState<number | null>(null);

  const handleAddOrUpdate = () => {
    if (!label.trim()) return alert("Label is required");

    const newField: CustomField = {
      id: editId ?? Date.now(),
      label,
      type,
      options: type === "select" ? options.split(",").map((o) => o.trim()) : undefined,
    };

    if (editId !== null) {
      // Update
      setFields((prev) =>
        prev.map((f) => (f.id === editId ? newField : f))
      );
    } else {
      // Add
      setFields((prev) => [...prev, newField]);
    }

    // Reset form
    setLabel("");
    setType("text");
    setOptions("");
    setEditId(null);
  };

  const handleEdit = (field: CustomField) => {
    setEditId(field.id);
    setLabel(field.label);
    setType(field.type);
    setOptions(field.options?.join(", ") || "");
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this custom field?")) {
      setFields((prev) => prev.filter((f) => f.id !== id));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow border">
      <h2 className="text-2xl font-bold mb-6">Custom Fields</h2>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Label</label>
          <input
            type="text"
            className="form-input w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            className="form-select w-full"
            value={type}
            onChange={(e) => setType(e.target.value as FieldType)}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Dropdown</option>
          </select>
        </div>

        {type === "select" && (
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Options (comma-separated)</label>
            <input
              type="text"
              className="form-input w-full"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
            />
          </div>
        )}
      </div>

      <button
        className="btn btn-primary mb-6"
        onClick={handleAddOrUpdate}
      >
        {editId ? "Update Field" : "Add Field"}
      </button>

      {/* List */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto border text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2 border">Label</th>
              <th className="px-4 py-2 border">Type</th>
              <th className="px-4 py-2 border">Options</th>
              <th className="px-4 py-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.id} className="border-t">
                <td className="px-4 py-2 border">{field.label}</td>
                <td className="px-4 py-2 border capitalize">{field.type}</td>
                <td className="px-4 py-2 border">
                  {field.type === "select" ? field.options?.join(", ") : "-"}
                </td>
                <td className="px-4 py-2 border text-center space-x-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleEdit(field)}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-sm btn-error"
                    onClick={() => handleDelete(field.id)}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 py-4">
                  No custom fields added.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomFieldsManager;
