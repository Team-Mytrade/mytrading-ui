import React from "react";
import { useNotification } from "./NotificationManager";

const DemoPage: React.FC = () => {
  const { notify } = useNotification();

  return (
    <div className="p-6 space-y-2">
      <button
        onClick={() => notify("success", "✅ Success notification")}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Show Success
      </button>
      <button
        onClick={() => notify("error", "❌ Error notification")}
        className="bg-red-500 text-white px-4 py-2 rounded"
      >
        Show Error
      </button>
      <button
        onClick={() => notify("info", "ℹ️ Info message")}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Show Info
      </button>
      <button
        onClick={() => notify("warning", "⚠️ Warning message")}
        className="bg-yellow-500 text-black px-4 py-2 rounded"
      >
        Show Warning
      </button>
    </div>
  );
};

export default DemoPage;
