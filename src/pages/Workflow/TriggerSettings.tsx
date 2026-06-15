import React, { useState } from "react";

interface TriggerSetting {
  id: number;
  name: string;           // Trigger name (e.g., Lead Created)
  enabled: boolean;       // Enable/disable trigger
  delayMinutes: number;   // Delay before trigger fires (optional)
  filters: string;        // Simple filter expression (optional)
}

const defaultTriggers: TriggerSetting[] = [
  { id: 1, name: "Lead Created", enabled: true, delayMinutes: 0, filters: "" },
  { id: 2, name: "Lead Updated", enabled: false, delayMinutes: 5, filters: "" },
  { id: 3, name: "Deal Created", enabled: true, delayMinutes: 0, filters: "" },
  { id: 4, name: "Deal Updated", enabled: false, delayMinutes: 10, filters: "" },
];

const TriggerSettings: React.FC = () => {
  const [triggers, setTriggers] = useState<TriggerSetting[]>(defaultTriggers);

  const updateTrigger = (
    id: number,
    key: keyof TriggerSetting,
    value: string | boolean | number
  ) => {
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [key]: value } : t))
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Trigger Settings</h2>
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Trigger</th>
            <th className="px-4 py-2 text-center">Enabled</th>
            <th className="px-4 py-2 text-center">Delay (minutes)</th>
            <th className="px-4 py-2 text-left">Filters</th>
          </tr>
        </thead>
        <tbody>
          {triggers.map(({ id, name, enabled, delayMinutes, filters }) => (
            <tr key={id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">{name}</td>
              <td className="px-4 py-2 text-center">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={enabled}
                  onChange={(e) => updateTrigger(id, "enabled", e.target.checked)}
                />
              </td>
              <td className="px-4 py-2 text-center">
                <input
                  type="number"
                  min={0}
                  className="form-input w-20 text-center"
                  value={delayMinutes}
                  onChange={(e) =>
                    updateTrigger(id, "delayMinutes", Number(e.target.value))
                  }
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="text"
                  placeholder="Filter expression"
                  className="form-input"
                  value={filters}
                  onChange={(e) => updateTrigger(id, "filters", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TriggerSettings;
