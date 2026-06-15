import React from "react";

// Status Badge Component
export const StatusBadge = ({ active }: { active: boolean }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
    active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
      active ? 'bg-green-500' : 'bg-red-500'
    }`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

// Toggle Component
export const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
      value ? 'bg-cyan-600' : 'bg-gray-200'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        value ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);
