import React, { useState } from "react";

const UserPreferences: React.FC = () => {
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("UTC");
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    inApp: true,
  });

  const handleSave = () => {
    const preferences = {
      theme,
      language,
      timezone,
      notifications,
    };
    console.log("Saved Preferences:", preferences);
    alert("Preferences saved successfully.");
    // TODO: POST to API endpoint
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow border rounded">
      <h2 className="text-2xl font-bold mb-6">⚙️ User Preferences</h2>

      {/* Theme */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Theme</label>
        <select
          className="form-select w-full"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System Default</option>
        </select>
      </div>

      {/* Language */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Language</label>
        <select
          className="form-select w-full"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="ar">Arabic</option>
        </select>
      </div>

      {/* Timezone */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Time Zone</label>
        <select
          className="form-select w-full"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">New York (EST)</option>
          <option value="Europe/London">London (GMT)</option>
          <option value="Asia/Kolkata">India (IST)</option>
        </select>
      </div>

      {/* Notifications */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Notifications</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifications.email}
              onChange={() =>
                setNotifications({ ...notifications, email: !notifications.email })
              }
            />
            <span>Email Notifications</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifications.sms}
              onChange={() =>
                setNotifications({ ...notifications, sms: !notifications.sms })
              }
            />
            <span>SMS Notifications</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifications.inApp}
              onChange={() =>
                setNotifications({ ...notifications, inApp: !notifications.inApp })
              }
            />
            <span>In-App Notifications</span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <button
        className="btn btn-primary w-full md:w-auto"
        onClick={handleSave}
      >
        💾 Save Preferences
      </button>
    </div>
  );
};

export default UserPreferences;
