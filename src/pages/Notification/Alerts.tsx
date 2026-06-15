import React, { useState } from "react";

type AlertType = "success" | "error" | "warning" | "info";

interface Alert {
  id: number;
  type: AlertType;
  message: string;
}

const alertColors = {
  success: "bg-green-100 text-green-800 border-green-400",
  error: "bg-red-100 text-red-800 border-red-400",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-400",
  info: "bg-blue-100 text-blue-800 border-blue-400",
};

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Add alert helper
  const addAlert = (type: AlertType, message: string) => {
    const id = Date.now();
    setAlerts((prev) => [...prev, { id, type, message }]);
    // Auto remove after 4s
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 4000);
  };

  // Remove alert on click
  const removeAlert = (id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Example triggers (can be removed)
  const triggerSuccess = () => addAlert("success", "Success! Operation completed.");
  const triggerError = () => addAlert("error", "Error! Something went wrong.");
  const triggerWarning = () => addAlert("warning", "Warning! Check your inputs.");
  const triggerInfo = () => addAlert("info", "Info! Here is some information.");

  return (
    <div className="max-w-xl mx-auto p-4">
      {/* Alert Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          className="btn bg-green-500 hover:bg-green-600 text-white"
          onClick={triggerSuccess}
        >
          Success
        </button>
        <button
          className="btn bg-red-500 hover:bg-red-600 text-white"
          onClick={triggerError}
        >
          Error
        </button>
        <button
          className="btn bg-yellow-400 hover:bg-yellow-500 text-black"
          onClick={triggerWarning}
        >
          Warning
        </button>
        <button
          className="btn bg-blue-500 hover:bg-blue-600 text-white"
          onClick={triggerInfo}
        >
          Info
        </button>
      </div>

      {/* Alerts list */}
      <div className="space-y-2">
        {alerts.map(({ id, type, message }) => (
          <div
            key={id}
            className={`border-l-4 p-4 rounded ${alertColors[type]} flex justify-between items-center shadow`}
          >
            <span>{message}</span>
            <button
              onClick={() => removeAlert(id)}
              className="ml-4 font-bold text-lg leading-none"
              aria-label="Close alert"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
